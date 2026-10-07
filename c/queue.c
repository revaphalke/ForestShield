#include "graph.h"
void q_init(Queue *q){q->head=q->tail=0;} int q_empty(const Queue *q){return q->head==q->tail;} void q_push(Queue *q,int v){q->data[q->tail]=v;q->tail=(q->tail+1)%MAX_NODES;} int q_pop(Queue *q){int v=q->data[q->head];q->head=(q->head+1)%MAX_NODES;return v;}
