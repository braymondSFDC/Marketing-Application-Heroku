'use strict';

const express = require('express');
const router = express.Router();
const { requireCanvasAuth } = require('../middleware/auth');
const { injectSalesforceContext } = require('../middleware/sfContext');
const { describeObject } = require('../services/salesforce');

router.use(requireCanvasAuth);
router.use(injectSalesforceContext);

/**
 * GET /api/fields/:objectName
 *
 * Personalization Engine — returns all available fields for Lead or Contact.
 * Used by the field picker in the React canvas to insert merge fields
 * like {{Lead.FirstName}} or {{Contact.Custom_Score__c}}.
 *
 * Groups fields into: Standard, Custom, Related
 */
router.get('/:objectName', async (req, res) => {
  try {
    const { objectName } = req.params;

    // Only allow Lead and Contact for security
    const allowed = ['Lead', 'Contact', 'Account', 'Opportunity', 'Campaign'];
    if (!allowed.includes(objectName)) {
      return res.status(400).json({
        error: `Object not supported. Allowed: ${allowed.join(', ')}`,
      });
    }

    const fields = await describeObject(req.sfConn, objectName);

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
      // Flat list for search
      allFields: fields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        custom: f.custom,
        mergeField: `{{${objectName}.${f.name}}}`,
      })),
    });
  } catch (err) {
    console.error('[Fields] Describe error:', err.message);
    res.status(500).json({ error: 'Failed to describe object fields' });
  }
});

module.exports = router;
