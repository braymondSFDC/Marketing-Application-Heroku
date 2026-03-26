'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * Default field definitions for standalone mode.
 * In Canvas mode, these come live from Salesforce via describeObject.
 * Here we provide the most common Lead/Contact fields for the
 * Personalization Engine field picker.
 */
const STANDALONE_FIELDS = {
  Contact: [
    { name: 'FirstName', label: 'First Name', type: 'string', custom: false },
    { name: 'LastName', label: 'Last Name', type: 'string', custom: false },
    { name: 'Email', label: 'Email', type: 'email', custom: false },
    { name: 'Phone', label: 'Phone', type: 'phone', custom: false },
    { name: 'Title', label: 'Title', type: 'string', custom: false },
    { name: 'Department', label: 'Department', type: 'string', custom: false },
    { name: 'MailingCity', label: 'Mailing City', type: 'string', custom: false },
    { name: 'MailingState', label: 'Mailing State', type: 'string', custom: false },
    { name: 'MailingCountry', label: 'Mailing Country', type: 'string', custom: false },
    { name: 'MailingPostalCode', label: 'Mailing Zip', type: 'string', custom: false },
    { name: 'Birthdate', label: 'Birthdate', type: 'date', custom: false },
    { name: 'LeadSource', label: 'Lead Source', type: 'picklist', custom: false },
    { name: 'AccountId', label: 'Account', type: 'reference', custom: false, referenceTo: ['Account'] },
    { name: 'OwnerId', label: 'Owner', type: 'reference', custom: false, referenceTo: ['User'] },
    { name: 'CreatedDate', label: 'Created Date', type: 'datetime', custom: false },
    { name: 'LastModifiedDate', label: 'Last Modified Date', type: 'datetime', custom: false },
    { name: 'Loyalty_Tier__c', label: 'Loyalty Tier', type: 'picklist', custom: true },
    { name: 'Score__c', label: 'Engagement Score', type: 'double', custom: true },
    { name: 'Preferred_Channel__c', label: 'Preferred Channel', type: 'picklist', custom: true },
  ],
  Lead: [
    { name: 'FirstName', label: 'First Name', type: 'string', custom: false },
    { name: 'LastName', label: 'Last Name', type: 'string', custom: false },
    { name: 'Email', label: 'Email', type: 'email', custom: false },
    { name: 'Phone', label: 'Phone', type: 'phone', custom: false },
    { name: 'Company', label: 'Company', type: 'string', custom: false },
    { name: 'Title', label: 'Title', type: 'string', custom: false },
    { name: 'Industry', label: 'Industry', type: 'picklist', custom: false },
    { name: 'Status', label: 'Status', type: 'picklist', custom: false },
    { name: 'Rating', label: 'Rating', type: 'picklist', custom: false },
    { name: 'City', label: 'City', type: 'string', custom: false },
    { name: 'State', label: 'State', type: 'string', custom: false },
    { name: 'Country', label: 'Country', type: 'string', custom: false },
    { name: 'PostalCode', label: 'Zip Code', type: 'string', custom: false },
    { name: 'NumberOfEmployees', label: 'Employees', type: 'int', custom: false },
    { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', custom: false },
    { name: 'LeadSource', label: 'Lead Source', type: 'picklist', custom: false },
    { name: 'OwnerId', label: 'Owner', type: 'reference', custom: false, referenceTo: ['User'] },
    { name: 'CreatedDate', label: 'Created Date', type: 'datetime', custom: false },
    { name: 'Lead_Score__c', label: 'Lead Score', type: 'double', custom: true },
    { name: 'Campaign_Source__c', label: 'Campaign Source', type: 'string', custom: true },
  ],
  Account: [
    { name: 'Name', label: 'Account Name', type: 'string', custom: false },
    { name: 'Type', label: 'Type', type: 'picklist', custom: false },
    { name: 'Industry', label: 'Industry', type: 'picklist', custom: false },
    { name: 'Phone', label: 'Phone', type: 'phone', custom: false },
    { name: 'Website', label: 'Website', type: 'url', custom: false },
    { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', custom: false },
    { name: 'NumberOfEmployees', label: 'Employees', type: 'int', custom: false },
  ],
  Opportunity: [
    { name: 'Name', label: 'Opportunity Name', type: 'string', custom: false },
    { name: 'StageName', label: 'Stage', type: 'picklist', custom: false },
    { name: 'Amount', label: 'Amount', type: 'currency', custom: false },
    { name: 'CloseDate', label: 'Close Date', type: 'date', custom: false },
    { name: 'Probability', label: 'Probability', type: 'percent', custom: false },
  ],
  Campaign: [
    { name: 'Name', label: 'Campaign Name', type: 'string', custom: false },
    { name: 'Type', label: 'Type', type: 'picklist', custom: false },
    { name: 'Status', label: 'Status', type: 'picklist', custom: false },
    { name: 'StartDate', label: 'Start Date', type: 'date', custom: false },
    { name: 'EndDate', label: 'End Date', type: 'date', custom: false },
  ],
};

/**
 * GET /api/fields/:objectName
 *
 * Personalization Engine — returns available fields for the given object.
 * In standalone mode, returns predefined field definitions.
 * When Canvas is active, these would come live from Salesforce.
 */
router.get('/:objectName', async (req, res) => {
  try {
    const { objectName } = req.params;

    const allowed = Object.keys(STANDALONE_FIELDS);
    if (!allowed.includes(objectName)) {
      return res.status(400).json({
        error: `Object not supported. Allowed: ${allowed.join(', ')}`,
      });
    }

    const fields = STANDALONE_FIELDS[objectName];

    // Group fields
    const grouped = {
      standard: [],
      custom: [],
      related: [],
    };

    for (const field of fields) {
      if (field.referenceTo && field.referenceTo.length > 0) {
        grouped.related.push(field);
      } else if (field.custom) {
        grouped.custom.push(field);
      } else {
        grouped.standard.push(field);
      }
    }

    res.json({
      objectName,
      totalFields: fields.length,
      fields: grouped,
      allFields: fields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        custom: f.custom,
        mergeField: `{{${objectName}.${f.name}}}`,
      })),
    });
  } catch (err) {
    console.error('[Fields] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

module.exports = router;
