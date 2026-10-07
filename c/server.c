/* ForestShield C graph engine HTTP server and CLI. */
#include "graph.h"
#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

#define PORT 8090
#define REQ_BUF 16384
#define BODY_BUF 16384
#define WEB_ROOT "c/web"
static volatile int g_running=1;
static void on_sig(int s){(void)s;g_running=0;}

static int write_all(int fd,const void *buf,size_t len){const char *p=buf;while(len){ssize_t n=write(fd,p,len);if(n<0){if(errno==EINTR)continue;return -1;}if(n==0)return -1;p+=n;len-=(size_t)n;}return 0;}
static void http_send(int fd,int status,const char *reason,const char *ctype,const char *body,size_t blen){char hdr[512];int n=snprintf(hdr,sizeof(hdr),"HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %zu\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",status,reason,ctype,blen);if(n>0)(void)write_all(fd,hdr,(size_t)n);if(body&&blen)(void)write_all(fd,body,blen);}
static void http_send_str(int fd,int status,const char *reason,const char *ctype,const char *body){http_send(fd,status,reason,ctype,body,body?strlen(body):0);}

static void append_int_array(char *buf,size_t cap,const int *a,int n){size_t len=strlen(buf);if(len+2>=cap)return;buf[len++]='[';buf[len]=0;for(int i=0;i<n;i++){char tmp[32];int m=snprintf(tmp,sizeof(tmp),"%s%d",i?",":"",a[i]);if(m<0||(size_t)m+len+2>=cap)break;memcpy(buf+len,tmp,(size_t)m+1);len+=(size_t)m;}if(len+2<cap){buf[len++]=']';buf[len]=0;}}
static void append_string_array(char *buf,size_t cap,const char a[][16],int n){size_t len=strlen(buf);if(len+2>=cap)return;buf[len++]='[';buf[len]=0;for(int i=0;i<n;i++){char tmp[32];int m=snprintf(tmp,sizeof(tmp),"%s\"%s\"",i?",":"",a[i]);if(m<0||(size_t)m+len+2>=cap)break;memcpy(buf+len,tmp,(size_t)m+1);len+=(size_t)m;}if(len+2<cap){buf[len++]=']';buf[len]=0;}}
static void json_escape(const char *s,char *out,size_t cap){size_t j=0;for(;s&&*s&&j+2<cap;s++){if(*s=='"'||*s=='\\'){out[j++]='\\';out[j++]=*s;}else if((unsigned char)*s<32)continue;else out[j++]=*s;}out[j]=0;}

static void result_to_json(const EvacuateResult *r,const char *forest,char zone,int from,char *buf,size_t cap){
    char err[96],summary[160];json_escape(r->error,err,sizeof(err));json_escape(r->scenario_summary,summary,sizeof(summary));
    int n=snprintf(buf,cap,"{\"ok\":%s,\"engine\":\"%s\",\"forest\":\"%s\",\"zone\":\"%c\",\"from\":%d,\"fires\":",r->ok?"true":"false",r->engine,forest?forest:"miyawaki",zone?zone:'A',from);if(n<0)return;
    append_int_array(buf,cap,r->fires,r->n_fires);strcat(buf,",\"predicted_spread\":");append_int_array(buf,cap,r->predicted_spread,r->n_predicted_spread);strcat(buf,",\"path\":");append_int_array(buf,cap,r->path,r->path_len);
    char tail[1200];snprintf(tail,sizeof(tail),",\"path_len\":%d,\"exit\":%d,\"distance_m\":%.1f,\"eta_min\":%.2f,\"risk_cost\":%.1f,\"danger\":",r->path_len,r->exit_cell,r->distance_m,r->eta_min,r->risk_cost);strncat(buf,tail,cap-strlen(buf)-1);append_int_array(buf,cap,r->danger,r->n_danger);strcat(buf,",\"caution\":");append_int_array(buf,cap,r->caution,r->n_caution);strcat(buf,",\"blocked\":");append_int_array(buf,cap,r->blocked_list,r->n_blocked);strcat(buf,",\"blocked_trails\":");append_string_array(buf,cap,r->blocked_trails,r->n_blocked_trails);
    snprintf(tail,sizeof(tail),",\"scenario_risk\":%d,\"scenario_summary\":\"%s\",\"spread_minutes\":%d,\"wind_direction\":%.0f,\"wind_speed_kph\":%.1f,\"slope_percent\":%.1f,\"error\":\"%s\",\"algorithm\":\"Modified Dijkstra + BFS scenario spread\"}",r->scenario_risk,summary,r->spread_minutes,r->wind_direction,r->wind_speed_kph,r->slope_percent,err);strncat(buf,tail,cap-strlen(buf)-1);
}

static const char *json_value(const char *body,const char *key){static char pat[96];snprintf(pat,sizeof(pat),"\"%s\"",key);const char *p=strstr(body,pat);if(!p)return NULL;p=strchr(p+strlen(pat),':');if(!p)return NULL;return p+1;}
static int json_number(const char *body,const char *key,double *out){const char *p=json_value(body,key);if(!p)return 0;while(*p==' '||*p=='\t')p++;char *end=NULL;double v=strtod(p,&end);if(end==p)return 0;*out=v;return 1;}
static int json_int(const char *body,const char *key,int *out){double v;if(!json_number(body,key,&v))return 0;*out=(int)v;return 1;}
static int json_array_ints(const char *body,const char *key,int *out,int cap){const char *p=json_value(body,key);if(!p)return 0;p=strchr(p,'[');if(!p)return 0;p++;int n=0;while(*p&&*p!=']'&&n<cap){while(*p&&(*p==' '||*p=='\t'||*p=='\r'||*p=='\n'||*p==','))p++;if(*p==']'||!*p)break;char *end=NULL;long v=strtol(p,&end,10);if(end==p)break;out[n++]=(int)v;p=end;}return n;}
static int json_array_strings(const char *body,const char *key,char out[][16],int cap){const char *p=json_value(body,key);if(!p)return 0;p=strchr(p,'[');if(!p)return 0;p++;int n=0;while(*p&&*p!=']'&&n<cap){while(*p&&(*p==' '||*p=='\t'||*p=='\r'||*p=='\n'||*p==','))p++;if(*p=='\"')p++;if(*p==']'||!*p)break;size_t j=0;while(*p&&*p!='\"'&&*p!=','&&*p!=']'&&j+1<16)out[n][j++]=*p++;out[n][j]=0;if(j)n++;while(*p&&*p!='\"'&&*p!=']')p++;if(*p=='\"')p++;}return n;}

static void handle_evacuate(int fd,const char *body){char forest[64]="miyawaki",zone[16]="A";int from=0,fires[MAX_FIRE_ZONES]={0},fire_count=0;char blocked_edges[MAX_BLOCKED_EDGES][16]={{0}};int blocked_count=0;ScenarioInputs inputs={0,0,0,0};double d;
    const char *v=json_value(body,"forest");if(v){while(*v==' '||*v=='\t')v++;if(*v=='\"'){v++;size_t i=0;while(v[i]&&v[i]!='\"'&&i+1<sizeof(forest)){forest[i]=v[i];i++;}forest[i]=0;}}
    v=json_value(body,"zone");if(v){while(*v==' '||*v=='\t')v++;if(*v=='\"'){v++;zone[0]=v[0];zone[1]=0;}}
    json_int(body,"from",&from);fire_count=json_array_ints(body,"fires",fires,MAX_FIRE_ZONES);blocked_count=json_array_strings(body,"blocked_trails",blocked_edges,MAX_BLOCKED_EDGES);json_int(body,"spread_minutes",&inputs.spread_minutes);if(json_number(body,"wind_direction",&d))inputs.wind_direction=d;if(json_number(body,"wind_speed_kph",&d))inputs.wind_speed_kph=d;if(json_number(body,"slope_percent",&d))inputs.slope_percent=d;
    EvacuateResult r=evacuate_compute_multi(forest,from,fires,fire_count,&inputs,blocked_edges,blocked_count);char json[BODY_BUF];result_to_json(&r,normalise_forest(forest),toupper((unsigned char)zone[0]),from,json,sizeof(json));http_send_str(fd,200,"OK","application/json; charset=utf-8",json);
}

static const char *mime_of(const char *path){const char *dot=strrchr(path,'.');if(!dot)return "application/octet-stream";if(strcmp(dot,".html")==0)return "text/html; charset=utf-8";if(strcmp(dot,".css")==0)return "text/css; charset=utf-8";if(strcmp(dot,".js")==0)return "application/javascript; charset=utf-8";if(strcmp(dot,".json")==0)return "application/json; charset=utf-8";if(strcmp(dot,".webp")==0)return "image/webp";if(strcmp(dot,".jpg")==0||strcmp(dot,".jpeg")==0)return "image/jpeg";if(strcmp(dot,".svg")==0)return "image/svg+xml";return "application/octet-stream";}
static int safe_join(char *out,size_t cap,const char *root,const char *rel){if(!rel||strstr(rel,".."))return -1;while(*rel=='/')rel++;if(!*rel)rel="index.html";int n=snprintf(out,cap,"%s/%s",root,rel);return n>0&&(size_t)n<cap?0:-1;}
static int try_send_file(int fd,const char *root,const char *url_path){char path[512];struct stat st;if(safe_join(path,sizeof(path),root,url_path)!=0)return 0;if(stat(path,&st)!=0||!S_ISREG(st.st_mode))return 0;int f=open(path,O_RDONLY);if(f<0)return 0;char *buf=malloc((size_t)st.st_size);if(!buf){(void)close(f);return 0;}ssize_t n=read(f,buf,(size_t)st.st_size);int close_rc=close(f);(void)close_rc;if(n<0){free(buf);return 0;}http_send(fd,200,"OK",mime_of(path),buf,(size_t)n);free(buf);return 1;}

static void handle_request(int fd,char *req,ssize_t n){char method[16]={0},url[1024]={0};req[n<REQ_BUF?n:REQ_BUF-1]=0;if(sscanf(req,"%15s %1023s",method,url)!=2){http_send_str(fd,400,"Bad Request","text/plain","bad request");return;}if(strcmp(method,"OPTIONS")==0){http_send_str(fd,204,"No Content","text/plain","");return;}
    char *qs=strchr(url,'?');if(qs){*qs=0;qs++;}else qs="";if(strcmp(url,"/health")==0||strcmp(url,"/api/health")==0){http_send_str(fd,200,"OK","application/json","{\"ok\":true,\"engine\":\"c-dijkstra\"}");return;}
    if(strcmp(url,"/api/evacuate")==0||strcmp(url,"/evacuate")==0){char *body=strstr(req,"\r\n\r\n");handle_evacuate(fd,body?body+4:"{}");return;}
    const char *rel=strcmp(url,"/")==0?"index.html":url;if(strncmp(url,"/maps/",6)==0){if(try_send_file(fd,"public/maps",url+6))return;}if(strncmp(url,"/config/",8)==0){if(try_send_file(fd,"config",url+8))return;}if(try_send_file(fd,WEB_ROOT,rel)){return;}http_send_str(fd,404,"Not Found","text/plain","not found");}

static int run_cli(int argc,char **argv){
    if(argc<5){fprintf(stderr,"usage: %s evacuate <forest> <from> <fire> [fire ...] [--spread N] [--wind-direction D] [--wind-speed KPH] [--slope P] [--blocked U-V,U-V]\n",argv[0]);return 2;}
    int fires[MAX_FIRE_ZONES]={0},n=0;ScenarioInputs in={0,0,0,0};char blocked[MAX_BLOCKED_EDGES][16]={{0}};int blocked_count=0;
    for(int i=4;i<argc;i++){
        if(strcmp(argv[i],"--spread")==0&&i+1<argc){in.spread_minutes=atoi(argv[++i]);continue;}
        if(strcmp(argv[i],"--wind-direction")==0&&i+1<argc){in.wind_direction=strtod(argv[++i],NULL);continue;}
        if(strcmp(argv[i],"--wind-speed")==0&&i+1<argc){in.wind_speed_kph=strtod(argv[++i],NULL);continue;}
        if(strcmp(argv[i],"--slope")==0&&i+1<argc){in.slope_percent=strtod(argv[++i],NULL);continue;}
        if(strcmp(argv[i],"--blocked")==0&&i+1<argc){char tmp[512];snprintf(tmp,sizeof(tmp),"%s",argv[++i]);char *tok=strtok(tmp,",");while(tok&&blocked_count<MAX_BLOCKED_EDGES){snprintf(blocked[blocked_count++],16,"%s",tok);tok=strtok(NULL,",");}continue;}
        int c=parse_cell(argv[i]);if(c>=0&&n<MAX_FIRE_ZONES)fires[n++]=c;
    }
    int from=parse_cell(argv[3]);EvacuateResult r=evacuate_compute_multi(argv[2],from,fires,n,&in,blocked,blocked_count);char json[BODY_BUF];result_to_json(&r,normalise_forest(argv[2]),'A',from,json,sizeof(json));puts(json);return r.ok?0:1;
}
static int run_server(void){int srv=socket(AF_INET,SOCK_STREAM,0),opt=1;if(srv<0){perror("socket");return 1;}signal(SIGPIPE,SIG_IGN);signal(SIGINT,on_sig);signal(SIGTERM,on_sig);(void)setsockopt(srv,SOL_SOCKET,SO_REUSEADDR,&opt,sizeof(opt));struct sockaddr_in addr={0};addr.sin_family=AF_INET;addr.sin_addr.s_addr=htonl(INADDR_ANY);addr.sin_port=htons(PORT);if(bind(srv,(struct sockaddr*)&addr,sizeof(addr))<0){perror("bind");(void)close(srv);return 1;}if(listen(srv,32)<0){perror("listen");(void)close(srv);return 1;}fprintf(stderr,"ForestShield C engine on 0.0.0.0:%d\n",PORT);while(g_running){struct sockaddr_in cli;socklen_t clen=sizeof(cli);int fd=accept(srv,(struct sockaddr*)&cli,&clen);if(fd<0){if(errno==EINTR)continue;break;}char req[REQ_BUF];ssize_t n=read(fd,req,sizeof(req)-1);if(n>0)handle_request(fd,req,n);int rc=close(fd);(void)rc;}int rc=close(srv);(void)rc;return 0;}
int main(int argc,char **argv){if(argc>=2&&strcmp(argv[1],"evacuate")==0)return run_cli(argc,argv);return run_server();}
