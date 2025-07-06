package main

import (
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

func main() {
	var cookiesPath, excludeDomainPattern string
	flag.StringVar(
		&cookiesPath,
		"path",
		"",
		"path to Cookies file e.g. $HOME/Library/Application Support/Google/Chrome/Default/Cookies",
	)
	flag.StringVar(
		&excludeDomainPattern,
		"exclude",
		"",
		"regexp pattern to exclude domains from Cookies db",
	)
	flag.Parse()

	if cookiesPath == "" {
		log.Println("missing required flag: -path")
		flag.Usage()
		os.Exit(1)
	}
	if excludeDomainPattern == "" {
		log.Println("missing required flag: -exclude")
		flag.Usage()
		os.Exit(1)
	}

	cookiesPath = os.ExpandEnv(cookiesPath)
	if _, err := os.Stat(cookiesPath); os.IsNotExist(err) {
		log.Fatalf("cookies file doesn't exist: %s", cookiesPath)
	}

	tmpFile, err := os.CreateTemp("", "Cookies")
	if err != nil {
		log.Fatalf("failed creating temp cookies db")
	}

	src, err := os.Open(cookiesPath)
	if err != nil {
		log.Fatal("failed opening cookies db")
	}
	defer src.Close()

	io.Copy(tmpFile, src)
	tmpFile.Close()

	db, err := sql.Open("sqlite3", tmpFile.Name())
	if err != nil {
		log.Fatal("failed opening cookies db with sqlite3")
	}
	defer db.Close()

	rows, err := db.Query(`SELECT host_key, path, is_secure, expires_utc, name, value, encrypted_value, is_httponly, samesite FROM cookies`)
	if err != nil {
		log.Fatal("query failed")
	}
	defer rows.Close()

	for rows.Next() {
		var host, path, name, value string
		var secure, httponly, samesite int
		var expires int64
		var encrypted []byte

		if err := rows.Scan(&host, &path, &secure, &expires, &name, &value, &encrypted, &httponly, &samesite); err != nil {
			continue
		}

		fmt.Println(host, path, name, value, secure, httponly, samesite, expires, encrypted)
	}
}
