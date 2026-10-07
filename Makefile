.PHONY: all clean run test
all:
	$(MAKE) -C c all
clean:
	$(MAKE) -C c clean
run:
	$(MAKE) -C c run
test:
	$(MAKE) -C c test
