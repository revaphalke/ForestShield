#include "graph.h"
static int less_item(PQItem a,PQItem b){return a.dist<b.dist||(a.dist==b.dist&&a.node<b.node);}
void pq_init(PriorityQueue *pq){pq->size=0;} int pq_empty(const PriorityQueue *pq){return pq->size==0;}
void pq_push(PriorityQueue *pq,int node,double dist){if(pq->size>=MAX_PQ)return;int i=pq->size++;pq->items[i]=(PQItem){node,dist};while(i>0){int p=(i-1)/2;if(!less_item(pq->items[i],pq->items[p]))break;PQItem t=pq->items[p];pq->items[p]=pq->items[i];pq->items[i]=t;i=p;}}
PQItem pq_pop(PriorityQueue *pq){PQItem top=pq->items[0];pq->items[0]=pq->items[--pq->size];int i=0;while(1){int l=2*i+1,r=2*i+2,s=i;if(l<pq->size&&less_item(pq->items[l],pq->items[s]))s=l;if(r<pq->size&&less_item(pq->items[r],pq->items[s]))s=r;if(s==i)break;PQItem t=pq->items[s];pq->items[s]=pq->items[i];pq->items[i]=t;i=s;}return top;}
