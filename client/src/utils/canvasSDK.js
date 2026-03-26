/**
 * Canvas SDK utility (preserved for future Canvas integration).
 *
 * In standalone mode, all functions are graceful no-ops.
 * When running inside a Salesforce Canvas iframe, these functions
 * interact with the parent Salesforce window via the Canvas SDK.
 */

/**
 * Resize the Canvas iframe to fit content.
 */
export function resizeCanvas(height) {
  if (window.Sfdc && window.Sfdc.canvas) {
    window.Sfdc.canvas.client.resize({ height: `${height}px` });
  }
}

/**
 * Refresh the signed request (extend session).
 */
export function refreshSignedRequest(callback) {
  if (window.Sfdc && window.Sfdc.canvas) {
    window.Sfdc.canvas.client.refreshSignedRequest((data) => {
      if (data.status === 200) {
        const signedRequest = data.payload.response;
        callback(null, signedRequest);
      } else {
        callback(new Error('Failed to refresh signed request'));
      }
    });
  }
}

/**
 * Navigate the parent Salesforce window to a URL.
 * Falls back to window.open in standalone mode.
 */
export function navigateToSalesforce(url) {
  if (window.Sfdc && window.Sfdc.canvas) {
    window.Sfdc.canvas.client.publish({
      name: 'canvas.navigate',
      payload: { url },
    });
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Check if we're running inside a Salesforce Canvas iframe.
 */
export function isCanvasContext() {
  return !!(window.Sfdc && window.Sfdc.canvas) || !!window.__CANVAS_CONTEXT__;
}
