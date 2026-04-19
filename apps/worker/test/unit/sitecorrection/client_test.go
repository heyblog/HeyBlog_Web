package sitecorrection_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"zhblogs.net/src/sitecorrection"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func newTestClient(fn roundTripFunc) *sitecorrection.Client {
	return sitecorrection.NewClient("https://api.example", "test-token", &http.Client{
		Transport: fn,
	})
}

func jsonResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}

func TestSubmitSiteCorrectionReturnsAppliedStateFromAPI(t *testing.T) {
	client := newTestClient(func(request *http.Request) (*http.Response, error) {
		if request.Header.Get("x-internal-token") != "test-token" {
			t.Fatalf("expected internal token header")
		}

		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		if !strings.Contains(string(body), `"site_id":"site-1"`) {
			t.Fatalf("expected site id in payload, got %s", string(body))
		}

		return jsonResponse(`{"ok":true,"data":{"applied":true}}`), nil
	})

	applied, errMessage := client.Submit(context.Background(), "site-1", map[string]any{
		"url": "https://example.com",
	})

	if errMessage != "" {
		t.Fatalf("expected no error, got %q", errMessage)
	}
	if !applied {
		t.Fatalf("expected applied correction")
	}
}

func TestSubmitSiteCorrectionReturnsFalseWhenAPIDidNotApply(t *testing.T) {
	client := newTestClient(func(request *http.Request) (*http.Response, error) {
		return jsonResponse(`{"ok":true,"data":{"applied":false}}`), nil
	})

	applied, errMessage := client.Submit(context.Background(), "site-1", map[string]any{
		"url": "https://example.com",
	})

	if errMessage != "" {
		t.Fatalf("expected no error, got %q", errMessage)
	}
	if applied {
		t.Fatalf("expected not applied")
	}
}

func TestSubmitSiteCorrectionReportsMalformedSuccessResponse(t *testing.T) {
	client := newTestClient(func(request *http.Request) (*http.Response, error) {
		return jsonResponse(`{"ok":true}`), nil
	})

	applied, errMessage := client.Submit(context.Background(), "site-1", map[string]any{
		"url": "https://example.com",
	})

	if applied {
		t.Fatalf("expected not applied")
	}
	if errMessage == "" {
		t.Fatalf("expected malformed response error")
	}
}
