package main

import (
	"log"

	"zhblogs.net/src/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatalf("worker stopped err=%v", err)
	}
}
