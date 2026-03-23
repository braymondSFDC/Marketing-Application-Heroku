'use strict';

const archiver = require('archiver');
const { generateFlowXml, generatePackageXml } = require('./flowGenerator');

/**
 * Deploy a generated Flow to Salesforce via the Metadata API.
 *
 * Steps:
 * 1. Generate Flow XML from journey canvas state
 * 2. Package into a ZIP with package.xml
 * 3. Deploy via jsforce metadata.deploy()
 * 4. Poll for completion
 * 5. Activate the Flow via Tooling API
 */
async function deployFlow(conn, journey, nodes, edges, templateMap) {
  // Step 1: Generate Flow XML
  const { flowApiName, xml } = generateFlowXml(journey, nodes, edges, templateMap);
  const packageXml = generatePackageXml(flowApiName);

  // Step 2: Create deployment ZIP
  const zipBuffer = await createDeploymentZip(flowApiName, xml, packageXml);

  // Step 3: Deploy via Metadata API
  console.log(`[DeployService] Deploying Flow: ${flowApiName}`);

  const deployResult = await conn.metadata.deploy(zipBuffer, {
    rollbackOnError: true,
    singlePackage: true,
  });

  // Step 4: Poll for completion
  const result = await pollDeployStatus(conn, deployResult.id);

  if (!result.success) {
    const errors = result.details?.componentFailures || [];
    const errorMessages = Array.isArray(errors)
      ? errors.map((e) => `${e.fullName}: ${e.problem}`).join('; ')
      : JSON.stringify(errors);
    throw new Error(`Flow deployment failed: ${errorMessages}`);
  }

  console.log(`[DeployService] Flow deployed successfully: ${flowApiName}`);

  return {
    flowApiName,
    deployId: deployResult.id,
    success: true,
  };
}

/**
 * Activate a deployed Flow using the Tooling API.
 * Must be called after successful deployment.
 */
async function activateFlow(conn, flowApiName) {
  // Query the Flow ID using Tooling API
  const queryResult = await conn.tooling.query(
    `SELECT Id, ActiveVersionId, LatestVersionId FROM FlowDefinition WHERE DeveloperName = '${flowApiName}'`
  );

  if (!queryResult.records || queryResult.records.length === 0) {
    throw new Error(`Flow not found: ${flowApiName}`);
  }

  const flowDef = queryResult.records[0];

  // Activate the latest version
  const updateResult = await conn.tooling.update('FlowDefinition', {
    Id: flowDef.Id,
    Metadata: {
      activeVersionNumber: null, // null to activate LatestVersionId
    },
  });

  // Alternative: Activate using the Flow record directly
  if (!updateResult.success) {
    // Try the Flow Version approach
    const versionQuery = await conn.tooling.query(
      `SELECT Id FROM Flow WHERE Definition.DeveloperName = '${flowApiName}' ORDER BY VersionNumber DESC LIMIT 1`
    );

    if (versionQuery.records.length > 0) {
      await conn.tooling.update('Flow', {
        Id: versionQuery.records[0].Id,
        Metadata: { status: 'Active' },
      });
    }
  }

  console.log(`[DeployService] Flow activated: ${flowApiName}`);
  return { flowApiName, active: true };
}

/**
 * Create a ZIP buffer for Metadata API deployment.
 */
function createDeploymentZip(flowApiName, flowXml, packageXml) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => buffers.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', reject);

    // Add package.xml at root
    archive.append(packageXml, { name: 'package.xml' });

    // Add Flow XML in the flows directory
    archive.append(flowXml, { name: `flows/${flowApiName}.flow-meta.xml` });

    archive.finalize();
  });
}

/**
 * Poll the Metadata API deployment status until complete.
 */
async function pollDeployStatus(conn, deployId, maxAttempts = 60, intervalMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await conn.metadata.checkDeployStatus(deployId, true);

    if (result.done) {
      return result;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Deployment timed out after ${maxAttempts * intervalMs / 1000}s`);
}

module.exports = {
  deployFlow,
  activateFlow,
  createDeploymentZip,
};
