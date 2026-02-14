# n8n REST API Management

## Overview

The n8n workflow can be managed programmatically via the n8n REST API. This is useful for:
- Fixing broken workflow connections
- Updating workflow nodes
- Activating/deactivating workflows
- Monitoring workflow health

**Important**: The `N8N_API_KEY` available in the Manus environment is a JWT token for the **MCP server API**, not the general n8n REST API. For general REST API access, you need to use the n8n instance's API credentials.

---

## n8n REST API Endpoints

### Base URL
```
https://designtec.app.n8n.cloud/api/v1
```

### Authentication
```bash
# Using API key in header
curl -H "X-N8N-API-KEY: $N8N_API_KEY" https://designtec.app.n8n.cloud/api/v1/workflows
```

---

## Common Operations

### 1. Get Workflow Details

```bash
BASE_URL="https://designtec.app.n8n.cloud"
WORKFLOW_ID="fRWD4L9r7WH4m81HlAkhV"

curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$BASE_URL/api/v1/workflows/$WORKFLOW_ID" \
  > workflow.json
```

### 2. Fix Broken Connections Programmatically

```python
import json
import os
import requests

BASE_URL = "https://designtec.app.n8n.cloud"
WORKFLOW_ID = "fRWD4L9r7WH4m81HlAkhV"
API_KEY = os.environ["N8N_API_KEY"]

# 1. Fetch workflow
response = requests.get(
    f"{BASE_URL}/api/v1/workflows/{WORKFLOW_ID}",
    headers={"X-N8N-API-KEY": API_KEY}
)
workflow = response.json()

# 2. Find the node with missing connection
for node in workflow["nodes"]:
    if node["name"] == "Receive Form Submission":
        # Add missing connection to "Extract Form Data"
        if "main" not in node or not node["main"] or not node["main"][0]:
            node["main"] = [[{"node": "Extract Form Data", "type": "main", "index": 0}]]
            print(f"✅ Added connection: {node['name']} → Extract Form Data")

# 3. Update workflow
update_response = requests.put(
    f"{BASE_URL}/api/v1/workflows/{WORKFLOW_ID}",
    headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"},
    json=workflow
)

if update_response.status_code == 200:
    print("✅ Workflow updated successfully")
else:
    print(f"❌ Failed to update workflow: {update_response.text}")
```

### 3. Activate/Deactivate Workflow

```bash
# Activate
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  "$BASE_URL/api/v1/workflows/$WORKFLOW_ID"

# Deactivate
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}' \
  "$BASE_URL/api/v1/workflows/$WORKFLOW_ID"
```

### 4. Get Workflow Execution History

```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$BASE_URL/api/v1/executions?workflowId=$WORKFLOW_ID&limit=10"
```

---

## Troubleshooting Workflow Issues

### Issue: Webhook returns no data

**Diagnosis**:
```bash
# Check if webhook node has output connections
python3 -c "
import json
with open('workflow.json') as f:
    workflow = json.load(f)
    
for node in workflow['nodes']:
    if node['type'] == 'n8n-nodes-base.webhook':
        connections = node.get('main', [[]])
        if not connections or not connections[0]:
            print(f'❌ Webhook node \"{node[\"name\"]}\" has no output connection')
        else:
            print(f'✅ Webhook node \"{node[\"name\"]}\" connected to: {connections[0][0][\"node\"]}')
"
```

**Fix**:
```python
# Add connection programmatically (see example above)
```

### Issue: Workflow not responding

**Diagnosis**:
```bash
# Check if workflow is active
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$BASE_URL/api/v1/workflows/$WORKFLOW_ID" | \
  python3 -c "import sys, json; w=json.load(sys.stdin); print('Active' if w.get('active') else 'Inactive')"
```

**Fix**:
```bash
# Activate workflow
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  "$BASE_URL/api/v1/workflows/$WORKFLOW_ID"
```

---

## Monitoring & Health Checks

### Check Webhook Availability

```bash
# Test webhook endpoint (should return 401 if auth is required)
curl -i https://designtec.app.n8n.cloud/webhook/legal-letter-submission

# Expected: HTTP 401 Unauthorized (means webhook is active and auth is enforced)
```

### Monitor Workflow Execution Rate

```bash
# Get last 100 executions
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$BASE_URL/api/v1/executions?workflowId=$WORKFLOW_ID&limit=100" | \
  python3 -c "
import sys, json
execs = json.load(sys.stdin)['data']
success = sum(1 for e in execs if e['finished'] and not e.get('stoppedAt'))
total = len(execs)
print(f'Success Rate: {success}/{total} ({100*success/total:.1f}%)')
"
```

---

## Best Practices

1. **Always backup before modifying**: Save the workflow JSON before making programmatic changes
2. **Test in staging first**: If possible, test workflow changes in a staging n8n instance
3. **Monitor execution logs**: Check n8n execution logs after making changes
4. **Use version control**: Store workflow JSON files in git for rollback capability
5. **Document changes**: Add comments in the workflow or maintain a changelog

---

## Reference

- **n8n API Documentation**: https://docs.n8n.io/api/
- **Workflow ID**: `fRWD4L9r7WH4m81HlAkhV`
- **Webhook URL**: `https://designtec.app.n8n.cloud/webhook/legal-letter-submission`
- **Instance URL**: `https://designtec.app.n8n.cloud`

---

## Example: Complete Workflow Health Check Script

```python
#!/usr/bin/env python3
"""
n8n Workflow Health Check
Verifies the Talk-to-My-Lawyer letter generation workflow is properly configured.
"""

import os
import json
import requests

BASE_URL = "https://designtec.app.n8n.cloud"
WORKFLOW_ID = "fRWD4L9r7WH4m81HlAkhV"
API_KEY = os.environ.get("N8N_API_KEY")

def check_workflow_health():
    print("🔍 Checking n8n workflow health...")
    
    # 1. Fetch workflow
    response = requests.get(
        f"{BASE_URL}/api/v1/workflows/{WORKFLOW_ID}",
        headers={"X-N8N-API-KEY": API_KEY}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to fetch workflow: {response.status_code}")
        return False
    
    workflow = response.json()
    
    # 2. Check if active
    if not workflow.get("active"):
        print("⚠️  Workflow is INACTIVE")
        return False
    else:
        print("✅ Workflow is ACTIVE")
    
    # 3. Check webhook connection
    webhook_connected = False
    for node in workflow["nodes"]:
        if node["type"] == "n8n-nodes-base.webhook":
            connections = node.get("main", [[]])
            if connections and connections[0]:
                webhook_connected = True
                print(f"✅ Webhook connected to: {connections[0][0]['node']}")
            else:
                print(f"❌ Webhook node '{node['name']}' has no output connection")
    
    if not webhook_connected:
        return False
    
    # 4. Test webhook endpoint
    webhook_response = requests.post(
        f"{BASE_URL}/webhook/legal-letter-submission",
        json={"test": "ping"}
    )
    
    if webhook_response.status_code == 401:
        print("✅ Webhook endpoint is active (returns 401 for unauthenticated requests)")
    else:
        print(f"⚠️  Webhook returned unexpected status: {webhook_response.status_code}")
    
    print("\n✅ Workflow health check PASSED")
    return True

if __name__ == "__main__":
    check_workflow_health()
```

Save this as `/home/ubuntu/check-n8n-health.py` and run with:
```bash
python3 /home/ubuntu/check-n8n-health.py
```
