#include "graph.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct Candidate { int cell; double score; } Candidate;

static int forest_index(const char *id) {
    const char *name = normalise_forest(id);
    if (strcmp(name, "anandvan") == 0) return 1;
    if (strcmp(name, "baner") == 0) return 2;
    if (strcmp(name, "tamhini") == 0) return 3;
    return 0;
}

const FsForestConfig *forest_config(const char *forest_id) { return &FS_FORESTS[forest_index(forest_id)]; }

void graph_init(Graph *g, int n) { g->n = n; for (int i = 0; i < MAX_NODES; i++) g->adj[i] = NULL; }
void graph_add_undirected(Graph *g, int u, int v, double w) {
    Edge *a = malloc(sizeof(*a)), *b = malloc(sizeof(*b));
    if (!a || !b) { free(a); free(b); return; }
    a->to=v; a->weight=w; a->next=NULL; b->to=u; b->weight=w; b->next=NULL;
    Edge **tail=&g->adj[u]; while (*tail) tail=&(*tail)->next; *tail=a;
    tail=&g->adj[v]; while (*tail) tail=&(*tail)->next; *tail=b;
}
void graph_free(Graph *g) { for (int i=0;i<MAX_NODES;i++){ Edge *e=g->adj[i]; while(e){Edge *n=e->next;free(e);e=n;} g->adj[i]=NULL;} g->n=0; }

static void make_edge_key(int u, int v, char out[16]) { if (u>v){int t=u;u=v;v=t;} snprintf(out,16,"%d-%d",u,v); }
int edge_is_blocked(int u, int v, const char blocked_edges[][16], int blocked_edge_count) {
    char key[16]; make_edge_key(u,v,key);
    for(int i=0;i<blocked_edge_count;i++) if(strcmp(key,blocked_edges[i])==0) return 1;
    return 0;
}

void graph_build_forest(Graph *g, const char *forest_id, const char blocked_edges[][16], int blocked_edge_count) {
    const FsForestConfig *cfg=forest_config(forest_id); int exit_node=cfg->grid_size*cfg->grid_size;
    graph_init(g, exit_node+1);
    for(int i=0;i<cfg->edge_count;i++){ const FsRawEdge *e=&cfg->edges[i]; if(!edge_is_blocked(e->u,e->v,blocked_edges,blocked_edge_count)) graph_add_undirected(g,e->u,e->v,e->weight); }
    for(int i=0;i<cfg->exit_count;i++){ int cell=cfg->exits[i]; double w=cfg->exit_weights[i]; if(w>0 && !edge_is_blocked(cell,exit_node,blocked_edges,blocked_edge_count)) graph_add_undirected(g,cell,exit_node,w); }
}

int neighbors4(int idx, int grid_size, int out[4]) {
    if(idx<0 || idx>=grid_size*grid_size) return 0;
    int r=idx/grid_size,c=idx%grid_size,n=0;
    const int dr[4]={-1,1,0,0},dc[4]={0,0,-1,1};
    for(int i=0;i<4;i++){int rr=r+dr[i],cc=c+dc[i];if(rr>=0&&rr<grid_size&&cc>=0&&cc<grid_size)out[n++]=rr*grid_size+cc;}
    return n;
}

const char *normalise_forest(const char *id){if(!id||!*id)return "miyawaki";if(strstr(id,"anand"))return "anandvan";if(strstr(id,"baner"))return "baner";if(strstr(id,"tamh")||strstr(id,"ghat"))return "tamhini";return "miyawaki";}

int parse_cell(const char *s){ if(!s||!*s)return -1; size_t n=strlen(s); if(n==2 && ((s[0]>='A'&&s[0]<='D')||(s[0]>='a'&&s[0]<='d')) && s[1]>='1'&&s[1]<='9') return s[1]-'1'; int v=atoi(s); if(n==1&&s[0]>='1'&&s[0]<='9')return s[0]-'1'; if(v>=0&&v<MAX_CELLS)return v; if(v>=1&&v<=MAX_CELLS)return v-1; return -1; }

static double direction_score(int source,int target,int grid,double wind_deg,double wind_speed,double slope){
    int sr=source/grid,sc=source%grid,tr=target/grid,tc=target%grid; double dx=(double)(tc-sc),dy=(double)(tr-sr); double rad=wind_deg*3.141592653589793/180.0; double wx=sin(rad),wy=-cos(rad); double align=dx*wx+dy*wy; if(align<0)align=0;if(align>1)align=1; return 1.0+align*(fmax(0.0,wind_speed)/20.0)*FS_WIND_BIAS_SCALE+(fmax(0.0,slope)/100.0)*FS_SLOPE_BIAS_SCALE;
}

void predict_fire_spread(const FsForestConfig *cfg,const int fires[MAX_FIRE_ZONES],int fire_count,const ScenarioInputs *inputs,int out[MAX_CELLS],int *out_count){
    int cell_count=cfg->grid_size*cfg->grid_size, predicted[MAX_CELLS]={0}, frontier[MAX_CELLS],frontier_n=0; *out_count=0;
    for(int i=0;i<fire_count;i++){int f=fires[i];if(f>=0&&f<cell_count&&!predicted[f]){predicted[f]=1;frontier[frontier_n++]=f;}}
    int steps=inputs?inputs->spread_minutes/10:0;if(steps<0)steps=0;if(steps>3)steps=3;
    for(int step=0;step<steps&&frontier_n;step++){
        Candidate candidates[MAX_CELLS]; int n=0;
        for(int i=0;i<frontier_n;i++){int nbrs[4],nn=neighbors4(frontier[i],cfg->grid_size,nbrs);for(int j=0;j<nn;j++){int v=nbrs[j];if(predicted[v])continue;double score=direction_score(frontier[i],v,cfg->grid_size,inputs->wind_direction,inputs->wind_speed_kph,inputs->slope_percent);int found=-1;for(int k=0;k<n;k++)if(candidates[k].cell==v){found=k;break;}if(found<0)candidates[n++]=(Candidate){v,score};else if(score>candidates[found].score)candidates[found].score=score;}}
        for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(candidates[j].score>candidates[i].score||(fabs(candidates[j].score-candidates[i].score)<1e-12&&candidates[j].cell<candidates[i].cell)){Candidate t=candidates[i];candidates[i]=candidates[j];candidates[j]=t;}
        int capacity=(int)lround((double)FS_SPREAD_CELLS_PER_10_MIN+fmax(0.0,inputs->wind_speed_kph)/20.0+fmax(0.0,inputs->slope_percent)/50.0);if(capacity<1)capacity=1;if(capacity>cell_count)capacity=cell_count; int next_n=0; for(int i=0;i<n&&next_n<capacity;i++){int v=candidates[i].cell;if(!predicted[v]){predicted[v]=1;frontier[next_n++]=v;}}
        frontier_n=next_n;
    }
    for(int i=0;i<cell_count;i++)if(predicted[i])out[(*out_count)++]=i;
}

void bfs_expand_fires(const FsForestConfig *cfg,const int fires[MAX_FIRE_ZONES],int fire_count,int start,int blocked[MAX_NODES],int caution[MAX_NODES],int danger_list[MAX_NODES],int *n_danger,int caution_list[MAX_NODES],int *n_caution){
    int cell_count=cfg->grid_size*cfg->grid_size; memset(blocked,0,sizeof(int)*MAX_NODES);memset(caution,0,sizeof(int)*MAX_NODES);*n_danger=*n_caution=0;
    for(int i=0;i<fire_count;i++){int f=fires[i];if(f>=0&&f<cell_count&&!blocked[f]){blocked[f]=1;danger_list[(*n_danger)++]=f;}}
    for(int i=0;i<*n_danger;i++){int nbrs[4],n=neighbors4(danger_list[i],cfg->grid_size,nbrs);for(int j=0;j<n;j++){int v=nbrs[j];if(!blocked[v]&&!caution[v]){caution[v]=1;caution_list[(*n_caution)++]=v;}}}
    if(start>=0&&start<cell_count&&caution[start]){caution[start]=0;for(int i=0;i<*n_caution;i++)if(caution_list[i]==start){for(int j=i;j+1<*n_caution;j++)caution_list[j]=caution_list[j+1];(*n_caution)--;break;}}
}

int recalculateRoute(const char *forest,int current,const int fires[MAX_FIRE_ZONES],int fire_count,const ScenarioInputs *inputs,const char blocked_edges[][16],int blocked_edge_count,EvacuateResult *result){
    Graph g;int mask[MAX_NODES]={0},caution[MAX_NODES]={0};double dist[MAX_NODES];int prev[MAX_NODES];const FsForestConfig *cfg=forest_config(forest);ScenarioInputs zero={0,0,0,0};if(!inputs)inputs=&zero;
    memset(result,0,sizeof(*result));snprintf(result->engine,sizeof(result->engine),"c-dijkstra");result->spread_minutes=inputs->spread_minutes;result->wind_direction=inputs->wind_direction;result->wind_speed_kph=inputs->wind_speed_kph;result->slope_percent=inputs->slope_percent;
    for(int i=0;i<fire_count&&i<MAX_FIRE_ZONES;i++)if(fires[i]>=0&&fires[i]<cfg->grid_size*cfg->grid_size)result->fires[result->n_fires++]=fires[i];
    for(int i=0;i<blocked_edge_count&&i<MAX_BLOCKED_EDGES;i++)snprintf(result->blocked_trails[result->n_blocked_trails++],16,"%s",blocked_edges[i]);
    if(current<0||current>=cfg->grid_size*cfg->grid_size){snprintf(result->error,sizeof(result->error),"INVALID_CELL");return 0;}
    if(result->n_fires==0){snprintf(result->error,sizeof(result->error),"NO_FIRE_ZONES");return 0;}
    for(int i=0;i<result->n_fires;i++)if(result->fires[i]==current){snprintf(result->error,sizeof(result->error),"START_ON_FIRE");return 0;}
    predict_fire_spread(cfg,result->fires,result->n_fires,inputs,result->predicted_spread,&result->n_predicted_spread);
    result->n_danger=result->n_predicted_spread;for(int i=0;i<result->n_danger;i++)result->danger[i]=result->predicted_spread[i];
    bfs_expand_fires(cfg,result->predicted_spread,result->n_predicted_spread,current,mask,caution,result->danger,&result->n_danger,result->caution,&result->n_caution);result->n_blocked=result->n_danger;for(int i=0;i<result->n_blocked;i++)result->blocked_list[i]=result->danger[i];
    result->scenario_risk=(int)lround(fmin(100.0,20.0+result->n_fires*18.0+fmax(0,result->n_predicted_spread-result->n_fires)*8.0+fmax(0,inputs->wind_speed_kph)*0.55+fmax(0,inputs->slope_percent)*0.2));snprintf(result->scenario_summary,sizeof(result->scenario_summary),"%s scenario risk · %d predicted fire cells",result->scenario_risk>=75?"high":result->scenario_risk>=45?"moderate":"low",result->n_predicted_spread);
    graph_build_forest(&g,forest,blocked_edges,blocked_edge_count);int exit_node=cfg->grid_size*cfg->grid_size;if(!dijkstra(&g,current,mask,caution,dist,prev)){graph_free(&g);snprintf(result->error,sizeof(result->error),"NO_SAFE_PATH");return 0;}if(!reconstruct_path(prev,current,exit_node,result->path,&result->path_len,&result->exit_cell)){graph_free(&g);snprintf(result->error,sizeof(result->error),"NO_SAFE_PATH");return 0;}
    result->risk_cost=dist[exit_node];result->distance_m=0;for(int i=0;i+1<result->path_len;i++){for(int e=0;e<cfg->edge_count;e++){if(((cfg->edges[e].u==result->path[i]&&cfg->edges[e].v==result->path[i+1])||(cfg->edges[e].u==result->path[i+1]&&cfg->edges[e].v==result->path[i]))&&!edge_is_blocked(result->path[i],result->path[i+1],blocked_edges,blocked_edge_count)){result->distance_m+=cfg->edges[e].weight;break;}}}for(int e=0;e<cfg->exit_count;e++)if(cfg->exits[e]==result->exit_cell){result->distance_m+=cfg->exit_weights[e];break;}
    result->eta_min=result->distance_m/WALK_MPS/60.0;result->ok=1;graph_free(&g);return 1;
}

EvacuateResult evacuate_compute_multi(const char *forest,int from,const int fires[MAX_FIRE_ZONES],int fire_count,const ScenarioInputs *inputs,const char blocked_edges[][16],int blocked_edge_count){EvacuateResult r;recalculateRoute(forest,from,fires,fire_count,inputs,blocked_edges,blocked_edge_count,&r);return r;}
