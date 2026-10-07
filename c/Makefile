CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -O2 -I.
LDFLAGS ?= -lm
OBJS = graph.o dijkstra.o queue.o priority_queue.o server.o
BIN = forestshield
.PHONY: all clean run test
all: $(BIN)
$(BIN): $(OBJS) graph_config.h
	$(CC) $(CFLAGS) -o $@ $(OBJS) $(LDFLAGS)
%.o: %.c graph.h graph_config.h
	$(CC) $(CFLAGS) -c $< -o $@
run: $(BIN)
	cd .. && ./c/$(BIN)
test: $(BIN)
	./$(BIN) evacuate miyawaki 4 6
	./$(BIN) evacuate anandvan 1 7
	./$(BIN) evacuate baner 0 8
clean:
	rm -f $(OBJS) $(BIN)
