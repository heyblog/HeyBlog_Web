package sitecorrection

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type siteCorrectionResponse struct {
	OK   bool                        `json:"ok"`
	Data *siteCorrectionResponseData `json:"data"`
}

type siteCorrectionResponseData struct {
	Applied bool `json:"applied"`
}

type Client struct {
	apiBaseURL       string
	apiInternalToken string
	httpClient       *http.Client
}

func NewClient(apiBaseURL string, apiInternalToken string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	return &Client{
		apiBaseURL:       apiBaseURL,
		apiInternalToken: apiInternalToken,
		httpClient:       httpClient,
	}
}

func (c *Client) Submit(
	ctx context.Context,
	siteID string,
	proposedChanges map[string]any,
) (bool, string) {
	if c.apiBaseURL == "" || c.apiInternalToken == "" || len(proposedChanges) == 0 {
		return false, ""
	}

	body, err := buildSiteCorrectionPayload(siteID, proposedChanges)
	if err != nil {
		return false, fmt.Sprintf("marshal correction payload: %v", err)
	}

	request, err := c.newSiteCorrectionRequest(ctx, body)
	if err != nil {
		return false, fmt.Sprintf("build correction request: %v", err)
	}

	response, err := c.httpClient.Do(request)
	if err != nil {
		return false, fmt.Sprintf("call correction api: %v", err)
	}
	defer response.Body.Close()

	return readSiteCorrectionResponse(response)
}

func buildSiteCorrectionPayload(siteID string, proposedChanges map[string]any) ([]byte, error) {
	payload := map[string]any{
		"site_id": siteID,
	}
	for key, value := range proposedChanges {
		payload[key] = value
	}

	return json.Marshal(payload)
}

func (c *Client) newSiteCorrectionRequest(
	ctx context.Context,
	body []byte,
) (*http.Request, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.apiBaseURL+"/api/internal/site-corrections",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}

	request.Header.Set("x-internal-token", c.apiInternalToken)
	request.Header.Set("content-type", "application/json")
	return request, nil
}

func readSiteCorrectionResponse(response *http.Response) (bool, string) {
	if response.StatusCode >= http.StatusBadRequest {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return false, fmt.Sprintf("correction api status=%d: %s", response.StatusCode, string(message))
	}

	payload := siteCorrectionResponse{}
	if err := json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&payload); err != nil {
		return false, fmt.Sprintf("decode correction api response: %v", err)
	}
	if !payload.OK {
		return false, "correction api returned ok=false"
	}
	if payload.Data == nil {
		return false, "correction api response missing data"
	}

	return payload.Data.Applied, ""
}
