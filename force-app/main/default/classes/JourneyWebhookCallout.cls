/**
 * JourneyWebhookCallout
 *
 * Apex class that performs HTTP callout to the Heroku Journey Builder
 * webhook endpoint when email engagement events occur.
 *
 * Called by a Platform Event-Triggered Flow subscribed to Email_Engagement__e.
 * Signs payloads with HMAC-SHA256 for verification on the Heroku side.
 */
public class JourneyWebhookCallout {

    private static final String HEROKU_ENDPOINT = 'https://marketing-application-heroku.herokuapp.com/api/webhooks/email-engagement';

    /**
     * Invocable method — called from Flow.
     * Receives engagement event data and forwards to Heroku.
     */
    @InvocableMethod(label='Send Engagement Webhook' description='Forward email engagement event to Heroku Journey Builder')
    public static void sendEngagementWebhook(List<EngagementRequest> requests) {
        for (EngagementRequest req : requests) {
            sendWebhookAsync(
                req.eventType,
                req.email,
                req.contactId,
                req.journeyId,
                req.nodeId,
                req.linkUrl
            );
        }
    }

    /**
     * Async callout to avoid Flow governor limits.
     */
    @future(callout=true)
    private static void sendWebhookAsync(
        String eventType,
        String email,
        String contactId,
        String journeyId,
        String nodeId,
        String linkUrl
    ) {
        try {
            // Build JSON payload
            Map<String, Object> payload = new Map<String, Object>{
                'eventType' => eventType,
                'email' => email,
                'contactId' => contactId,
                'journeyId' => journeyId,
                'nodeId' => nodeId,
                'linkUrl' => linkUrl,
                'timestamp' => Datetime.now().formatGMT('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'')
            };

            String jsonBody = JSON.serialize(payload);

            // Generate HMAC-SHA256 signature
            String webhookSecret = getWebhookSecret();
            Blob hmac = Crypto.generateMac('HmacSHA256', Blob.valueOf(jsonBody), Blob.valueOf(webhookSecret));
            String signature = EncodingUtil.convertToHex(hmac);

            // Make the callout
            HttpRequest httpReq = new HttpRequest();
            httpReq.setEndpoint(HEROKU_ENDPOINT);
            httpReq.setMethod('POST');
            httpReq.setHeader('Content-Type', 'application/json');
            httpReq.setHeader('x-webhook-signature', signature);
            httpReq.setBody(jsonBody);
            httpReq.setTimeout(30000); // 30 second timeout

            Http http = new Http();
            HttpResponse httpRes = http.send(httpReq);

            if (httpRes.getStatusCode() != 200) {
                System.debug(LoggingLevel.ERROR, 'Webhook failed: ' + httpRes.getStatusCode() + ' - ' + httpRes.getBody());
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Webhook callout error: ' + e.getMessage());
        }
    }

    /**
     * Retrieve the shared webhook secret from Custom Metadata or Named Credential.
     */
    private static String getWebhookSecret() {
        // Option 1: Custom Metadata Type
        // Journey_Builder_Settings__mdt settings = Journey_Builder_Settings__mdt.getInstance('Default');
        // return settings.Webhook_Secret__c;

        // Option 2: Custom Setting
        // return Journey_Builder_Settings__c.getOrgDefaults().Webhook_Secret__c;

        // Fallback: hardcoded for initial setup (replace with Custom Metadata in production)
        return 'REPLACE_WITH_WEBHOOK_SECRET';
    }

    /**
     * Wrapper class for Flow invocable inputs.
     */
    public class EngagementRequest {
        @InvocableVariable(required=true label='Event Type')
        public String eventType;

        @InvocableVariable(label='Email')
        public String email;

        @InvocableVariable(label='Contact ID')
        public String contactId;

        @InvocableVariable(label='Journey ID')
        public String journeyId;

        @InvocableVariable(label='Node ID')
        public String nodeId;

        @InvocableVariable(label='Link URL')
        public String linkUrl;
    }
}
