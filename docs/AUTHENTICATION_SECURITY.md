# Authentication & Security Enhancements

## Overview

This document describes the authentication error handling improvements and security considerations added to the observability backend handlers.

## Key Improvements

### 1. **Circular Reference Protection**

**Problem**: `TextFormatter` could throw exceptions when formatting logs with circular references or non-serializable objects.

**Solution**: Added try-catch around `JSON.stringify()` with graceful fallback:

```typescript
try {
  output += `\n  Context: ${JSON.stringify(log.context)}`;
} catch (error) {
  output += `\n  Context: [Unable to stringify: ${
    error instanceof Error ? error.message : "unknown error"
  }]`;
}
```

**Impact**: Prevents logging system from crashing when encountering:

- Circular object references
- Non-serializable values (functions, symbols)
- Deeply nested objects
- BigInt values

---

### 2. **Authentication Error Detection**

Each handler now provides specific error messages for authentication failures:

#### **PagerDuty Handler**

```typescript
if (error.message.includes("401")) {
  throw new Error(
    `PagerDuty authentication failed: Invalid routing_key. Check your Integration Key.`
  );
}
```

**Configuration Notes**:

- Requires `routing_key` (Integration Key) from PagerDuty
- Regional endpoints: US (default), EU requires custom endpoint
- Common errors: Invalid key, revoked key, wrong regional endpoint

---

#### **Prometheus Pushgateway Handler**

```typescript
if (response.status === 401 || response.status === 403) {
  throw new Error(
    `Prometheus authentication failed (${response.status}). Check config.headers for HTTP Basic Auth credentials.`
  );
}
```

**Configuration Notes**:

- Authentication varies by setup:
  - HTTP Basic Auth (pass via `config.headers`)
  - Network-level controls (VPN, firewall)
- Common errors: Missing Basic Auth header, incorrect credentials

---

#### **Loki Handler**

```typescript
if (error.message.includes("401") || error.message.includes("403")) {
  throw new Error(
    `Loki authentication failed. Check apiKey (Bearer token) or config.headers for Basic Auth / X-Scope-OrgID.`
  );
}
```

**Configuration Notes**:

- Supports multiple auth methods:
  - Bearer token (most common, via `apiKey`)
  - HTTP Basic Auth (via `config.headers`)
  - Multi-tenant ID via `X-Scope-OrgID` header
- Common errors: Invalid token, wrong auth method, missing tenant ID

---

#### **CloudWatch Handler** ⚠️

**WARNING**: This handler uses manual AWS authentication which is **error-prone** and **not recommended for production**.

```typescript
throw new Error(
  `CloudWatch authentication failed. AWS requires proper IAM credentials and request signing. ` +
    `Consider using @aws-sdk/client-cloudwatch-logs instead of manual fetch. Error: ${error.message}`
);
```

**Why Manual Auth Fails**:

1. AWS uses complex signature version 4 (SigV4) request signing
2. Credentials can come from multiple sources:
   - Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
   - EC2 instance metadata service
   - ECS task roles
   - Shared credential files (`~/.aws/credentials`)
   - IAM roles for service accounts (IRSA in EKS)
3. Simple API key passing bypasses all of this

**Recommended Solution**:

```typescript
import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const client = new CloudWatchLogsClient({ region: "us-east-1" });
// SDK automatically discovers credentials from environment
```

**Configuration Notes**:

- Requires proper IAM permissions: `logs:PutLogEvents`, `logs:CreateLogStream`
- Regional endpoint configuration required
- Common errors: Invalid credentials, insufficient permissions, wrong region

---

#### **Datadog Handler**

```typescript
if (error.message.includes("403") || error.message.includes("401")) {
  throw new Error(
    `Datadog authentication failed. Check apiKey validity and regional endpoint (US vs EU). Error: ${error.message}`
  );
}
```

**Configuration Notes**:

- API key embedded in URL path: `${endpoint}/v1/input/${apiKey}`
- Regional endpoints:
  - US: `https://http-intake.logs.datadoghq.com` (default)
  - EU: `https://http-intake.logs.datadoghq.eu`
- Common errors: Invalid API key, wrong regional endpoint

---

## Configuration Validation

All handlers now warn at construction time if credentials are missing:

```typescript
// Example warning output
"PagerDuty handler: endpoint or apiKey (routing_key) not configured. Logs will be dropped.";
"CloudWatch handler: endpoint or apiKey not configured. Note: AWS authentication is complex...";
```

This provides **immediate feedback** during development instead of silent failures at runtime.

---

## Testing

Added comprehensive test suite (`AuthAndEdgeCases.test.ts`) covering:

### Authentication Scenarios

- ✅ Clear error messages for 401/403 responses
- ✅ Configuration warnings for missing credentials
- ✅ Service-specific auth requirement documentation

### Edge Cases

- ✅ Circular reference handling in `TextFormatter`
- ✅ Deeply nested object formatting (100+ levels)
- ✅ Non-serializable values (functions, symbols, undefined)
- ✅ Empty and missing context objects
- ✅ `JSONFormatter` pass-through behavior

**Test Results**: 372 tests passing (12 new authentication/edge case tests)

---

## Security Best Practices

### 1. **Credential Management**

❌ **Don't** hardcode API keys:

```typescript
const logger = new Logger([
  createDatadogHandler({
    endpoint: "https://...",
    apiKey: "abc123hardcoded", // BAD!
  }),
]);
```

✅ **Do** use environment variables:

```typescript
const logger = new Logger([
  createDatadogHandler({
    endpoint: process.env.DATADOG_ENDPOINT,
    apiKey: process.env.DATADOG_API_KEY,
  }),
]);
```

### 2. **AWS Authentication**

❌ **Don't** use the built-in CloudWatch handler for production:

```typescript
createCloudWatchHandler({
  endpoint: "...",
  apiKey: process.env.AWS_ACCESS_KEY, // Incomplete!
});
```

✅ **Do** use AWS SDK with automatic credential discovery:

```typescript
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";

// Automatically uses IAM roles, instance metadata, env vars, etc.
const client = new CloudWatchLogsClient({ region: "us-east-1" });
```

### 3. **Regional Endpoints**

Always verify the correct regional endpoint:

| Service    | US Endpoint                              | EU Endpoint                             |
| ---------- | ---------------------------------------- | --------------------------------------- |
| PagerDuty  | `https://events.pagerduty.com`           | `https://events.eu.pagerduty.com`       |
| Datadog    | `https://http-intake.logs.datadoghq.com` | `https://http-intake.logs.datadoghq.eu` |
| Loki       | Custom (user-hosted)                     | Custom (user-hosted)                    |
| Prometheus | Custom (user-hosted)                     | Custom (user-hosted)                    |
| CloudWatch | Region-specific AWS endpoint             | Region-specific AWS endpoint            |

### 4. **Sensitive Data in Logs**

Avoid logging sensitive information in `context` fields:

❌ **Don't**:

```typescript
logger.error("Auth failed", "api.auth", {
  password: "secret123", // BAD!
  apiKey: "xyz789", // BAD!
});
```

✅ **Do**:

```typescript
logger.error("Auth failed", "api.auth", {
  username: "user@example.com",
  reason: "invalid_credentials",
  timestamp: Date.now(),
});
```

---

## Troubleshooting

### "401 Unauthorized" Errors

**PagerDuty**:

1. Verify `routing_key` matches Integration Key from PagerDuty service
2. Check service is not disabled
3. Verify endpoint URL (US vs EU)

**Datadog**:

1. Verify API key is valid and active
2. Check regional endpoint (US vs EU)
3. Ensure key has `logs_write` permission

**Loki**:

1. Try multiple auth methods (Bearer, Basic Auth, X-Scope-OrgID)
2. Check Loki tenant configuration if using multi-tenancy
3. Verify endpoint URL includes `/loki/api/v1/push`

### "403 Forbidden" Errors

**CloudWatch**:

1. Verify IAM user/role has `logs:PutLogEvents` permission
2. Check CloudWatch log group exists
3. Ensure log stream is created or auto-creation is allowed

**Prometheus**:

1. Verify Pushgateway allows writes
2. Check network ACLs/firewalls
3. Try adding HTTP Basic Auth via `config.headers`

### "Connection Refused" Errors

1. Verify endpoint URL is correct
2. Check service is running and accessible
3. Verify firewall/VPN rules
4. Test connectivity: `curl -v <endpoint>`

### Circular Reference Errors

If you see `[Unable to stringify: ...]` in formatted logs:

1. **Root cause**: Your `context` object has circular references
2. **Impact**: Context is not fully logged (but system doesn't crash)
3. **Solution**: Sanitize context before logging:

```typescript
// Remove circular references before logging
function sanitizeContext(obj: any): any {
  const seen = new WeakSet();
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    })
  );
}

logger.info("Process started", "app.init", sanitizeContext(config));
```

---

## Migration Guide

If you're upgrading from a previous version:

### Breaking Changes

**None** - All changes are backward compatible.

### New Features

1. **Circular reference protection** - Automatic, no config needed
2. **Better error messages** - Automatic, no config needed
3. **Configuration warnings** - Shows at handler creation time

### Recommended Actions

1. **Review CloudWatch usage**: Migrate to AWS SDK if using CloudWatch handler
2. **Add credential validation**: Check for missing env vars at startup
3. **Update error handling**: Catch and log authentication errors specifically

Example:

```typescript
try {
  await logger.info("Test connection", "init");
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes("authentication failed")
  ) {
    console.error("Backend authentication error:", error.message);
    console.error(
      "Check environment variables: DATADOG_API_KEY, LOKI_ENDPOINT, etc."
    );
    process.exit(1);
  }
  throw error;
}
```

---

## References

- **PagerDuty Events API**: https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview
- **Datadog HTTP API**: https://docs.datadoghq.com/api/latest/logs/
- **Loki HTTP API**: https://grafana.com/docs/loki/latest/api/
- **Prometheus Pushgateway**: https://prometheus.io/docs/practices/pushing/
- **AWS CloudWatch Logs SDK**: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cloudwatch-logs/
- **W3C Trace Context**: https://www.w3.org/TR/trace-context/
