package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/pbkdf2"
)

type Cookie struct {
	Name     string   `json:"name"`
	Value    string   `json:"value"`
	Domain   string   `json:"domain"`
	Path     string   `json:"path"`
	Expires  int64    `json:"expires"`
	HTTPOnly bool     `json:"httpOnly"`
	Secure   bool     `json:"secure"`
	SameSite SameSite `json:"sameSite,omitempty"`
}

func NewCookie(name, value string) *Cookie {
	return &Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HTTPOnly: true,
		Secure:   true,
		SameSite: SameSiteLax,
	}
}

type SameSite string

const (
	SameSiteStrict SameSite = "Strict"
	SameSiteLax    SameSite = "Lax"
	SameSiteNone   SameSite = "None"
)

func (c *Cookie) setSameSite(samesite int) {
	switch samesite {
	case 2:
		c.SameSite = SameSiteStrict
	case 1:
		c.SameSite = SameSiteLax
	case 0:
		c.SameSite = SameSiteNone
	default:
		c.SameSite = ""
	}
}

func (c *Cookie) setExpires(expires int64) {
	if expires > 0 {
		c.Expires = (expires / 1000000) - 11644473600
	} else {
		c.Expires = 0
	}
}

type Cookies []*Cookie

func main() {
	var cookiesPath string
	flag.StringVar(
		&cookiesPath,
		"path",
		"",
		"path to Cookies file e.g. $HOME/Library/Application Support/Google/Chrome/Default/Cookies",
	)
	flag.Parse()
	if cookiesPath == "" {
		log.Println("missing required flag: -path")
		flag.Usage()
		os.Exit(1)
	}

	cookiesPath = os.ExpandEnv(cookiesPath)
	if _, err := os.Stat(cookiesPath); os.IsNotExist(err) {
		log.Fatalf("cookies file doesn't exist: %s", cookiesPath)
	}

	decryptionKey := getDecryptionKey()

	tmpFile, err := os.CreateTemp("", "cookies*.db")
	if err != nil {
		log.Fatalf("failed creating temp cookies db")
	}
	defer os.Remove(tmpFile.Name())

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

	cookies := make(Cookies, 0)
	for rows.Next() {
		var host, path, name, value string
		var secure, httponly, samesite int
		var expires int64
		var encrypted []byte

		if err := rows.Scan(&host, &path, &secure, &expires, &name, &value, &encrypted, &httponly, &samesite); err != nil {
			continue
		}

		if value == "" && len(encrypted) > 0 {
			val, err := decryptCookie(encrypted, decryptionKey)
			if err == nil {
				value = val
			}
		}

		cookie := NewCookie(name, value)
		cookie.Domain = host
		cookie.Path = path
		cookie.Secure = secure != 0
		cookie.HTTPOnly = httponly != 0
		cookie.setExpires(expires)
		cookie.setSameSite(samesite)

		cookies = append(cookies, cookie)
	}

	output, err := json.MarshalIndent(cookies, "", "  ")
	if err != nil {
		log.Fatalf("failed to marshal cookies to JSON: %v", err)
	}

	fmt.Println(string(output))
}

func decryptCookie(encrypted, key []byte) (string, error) {
	if !bytes.HasPrefix(encrypted, []byte("v10")) {
		return "", nil
	}

	encrypted = encrypted[3:]
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	iv := bytes.Repeat([]byte(" "), 16)
	mode := cipher.NewCBCDecrypter(block, iv)
	decrypted := make([]byte, len(encrypted))
	mode.CryptBlocks(decrypted, encrypted)

	paddingLen := int(decrypted[len(decrypted)-1])
	if paddingLen > aes.BlockSize || paddingLen == 0 {
		return "", fmt.Errorf("invalid padding")
	}
	decrypted = decrypted[:len(decrypted)-paddingLen]

	if len(decrypted) > 32 {
		decrypted = decrypted[32:]
	}

	return string(decrypted), nil
}

func getDecryptionKey() []byte {
	cmd := exec.Command("/usr/bin/security", "-q", "find-generic-password", "-w", "-a", "Chrome", "-s", "Chrome Safe Storage")
	password, err := cmd.Output()
	if err != nil {
		password = []byte("peanuts")
	}
	password = bytes.TrimSpace(password)
	return pbkdf2.Key(password, []byte("saltysalt"), 1003, 16, sha1.New)
}
