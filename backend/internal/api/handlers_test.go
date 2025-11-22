package api

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUploadFile_ReturnsFullURL(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a test server
	server := NewServer()

	// Create a temporary directory for uploads
	tmpDir := t.TempDir()
	os.Setenv("UPLOAD_DIR", tmpDir)
	defer os.Unsetenv("UPLOAD_DIR")

	// Create a simple test image (1x1 PNG)
	pngData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
		0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
		0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
		0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
		0x44, 0xAE, 0x42, 0x60, 0x82,
	}

	// Create multipart form data
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Create form file with proper content type header
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="upload"; filename="test.png"`)
	h.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(h)
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}
	
	_, err = io.Copy(part, bytes.NewReader(pngData))
	if err != nil {
		t.Fatalf("Failed to write file data: %v", err)
	}
	
	err = writer.Close()
	if err != nil {
		t.Fatalf("Failed to close writer: %v", err)
	}

	// Create request
	req := httptest.NewRequest(http.MethodPost, "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Host = "localhost:8080"

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	server.router.ServeHTTP(w, req)

	// Check response code
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
		t.Logf("Response body: %s", w.Body.String())
		return
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Check that URL is present
	url, ok := response["url"].(string)
	if !ok {
		t.Fatalf("Expected 'url' field in response, got: %v", response)
	}

	// Verify URL format includes full server URL
	if !strings.HasPrefix(url, "http://localhost:8080/uploads/") {
		t.Errorf("Expected URL to start with 'http://localhost:8080/uploads/', got: %s", url)
	}

	// Verify the file was actually saved
	filename := filepath.Base(url[len("http://localhost:8080/uploads/"):])
	savedPath := filepath.Join(tmpDir, filename)
	if _, err := os.Stat(savedPath); os.IsNotExist(err) {
		t.Errorf("Expected file to be saved at %s, but it doesn't exist", savedPath)
	}
}

func TestUploadFile_WithServerURLEnv(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a test server
	server := NewServer()

	// Create a temporary directory for uploads
	tmpDir := t.TempDir()
	os.Setenv("UPLOAD_DIR", tmpDir)
	defer os.Unsetenv("UPLOAD_DIR")

	// Set custom SERVER_URL environment variable
	os.Setenv("SERVER_URL", "https://example.com")
	defer os.Unsetenv("SERVER_URL")

	// Create a simple test image (1x1 PNG)
	pngData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
		0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
		0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
		0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
		0x44, 0xAE, 0x42, 0x60, 0x82,
	}

	// Create multipart form data
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	
	// Create form file with proper content type header
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="upload"; filename="test.png"`)
	h.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(h)
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}
	
	_, err = io.Copy(part, bytes.NewReader(pngData))
	if err != nil {
		t.Fatalf("Failed to write file data: %v", err)
	}
	
	err = writer.Close()
	if err != nil {
		t.Fatalf("Failed to close writer: %v", err)
	}

	// Create request
	req := httptest.NewRequest(http.MethodPost, "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Host = "localhost:8080"

	// Create response recorder
	w := httptest.NewRecorder()

	// Perform request
	server.router.ServeHTTP(w, req)

	// Check response code
	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
		t.Logf("Response body: %s", w.Body.String())
		return
	}

	// Parse response
	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	// Check that URL is present
	url, ok := response["url"].(string)
	if !ok {
		t.Fatalf("Expected 'url' field in response, got: %v", response)
	}

	// Verify URL uses the SERVER_URL environment variable
	if !strings.HasPrefix(url, "https://example.com/uploads/") {
		t.Errorf("Expected URL to start with 'https://example.com/uploads/', got: %s", url)
	}
}
