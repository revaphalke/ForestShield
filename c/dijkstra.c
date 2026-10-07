#include "graph.h"
int dijkstra(const Graph *g,int src,const int blocked[MAX_NODES],const int caution[MAX_NODES],double dist[MAX_NODES],int prev[MAX_NODES]){
    PriorityQueue pq;pq_init(&pq);for(int i=0;i<g->n;i++){dist[i]=INF_DIST;prev[i]=-1;}if(src<0||src>=g->n)return 0;dist[src]=0;pq_push(&pq,src,0);
    while(!pq_empty(&pq)){PQItem it=pq_pop(&pq);int u=it.node;if(it.dist>dist[u]+1e-9)continue;for(Edge *e=g->adj[u];e;e=e->next){int v=e->to;if(v!=src&&blocked[v])continue;double w=(caution[u]||caution[v])?e->weight*CAUTION_MULT:e->weight;double nd=dist[u]+w;if(nd+1e-12<dist[v]){dist[v]=nd;prev[v]=u;pq_push(&pq,v,nd);}}}
    int exit_node=g->n-1;return dist[exit_node]<INF_DIST/2.0;
}

int reconstruct_path(const int prev[MAX_NODES],int src,int exit_node,int path[MAX_PATH],int *path_len,int *exit_cell){int tmp[MAX_PATH+1],n=0,cur=exit_node;while(cur!=-1&&n<MAX_PATH+1){tmp[n++]=cur;if(cur==src)break;cur=prev[cur];}if(n==0||tmp[n-1]!=src)return 0;*path_len=0;*exit_cell=-1;for(int i=n-1;i>=0;i--){if(tmp[i]==exit_node)continue;path[(*path_len)++]=tmp[i];*exit_cell=tmp[i];}return *path_len>0;}
