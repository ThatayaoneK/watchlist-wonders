# Vertex AI Vector Search — one-time setup

The pipeline reads the following env vars (set via `firebase functions:secrets:set` or in the runtime config):

| Variable | Example | Notes |
| --- | --- | --- |
| `VERTEX_PROJECT_ID` | `watchmarks-prod` | Defaults to `GCLOUD_PROJECT` if unset |
| `VERTEX_LOCATION` | `us-central1` | The only region we deploy to today |
| `VERTEX_INDEX_ID` | `1234567890` | numeric ID, not the display name |
| `VERTEX_INDEX_ENDPOINT_ID` | `9876543210` |  |
| `VERTEX_DEPLOYED_INDEX_ID` | `watchmarks_v1` | the deployed-index ID, not the endpoint ID |

## 1. Provision the index

```bash
gcloud ai indexes create \
  --project=$VERTEX_PROJECT_ID \
  --region=$VERTEX_LOCATION \
  --display-name=watchmarks-text-embeddings \
  --description="text-embedding-005 (768-dim) for Watchmarks bookmarks" \
  --metadata-file=index-metadata.json
```

Where `index-metadata.json` contains:

```json
{
  "contentsDeltaUri": "gs://YOUR_BUCKET/watchmarks-index-empty/",
  "config": {
    "dimensions": 768,
    "approximateNeighborsCount": 50,
    "shardSize": "SHARD_SIZE_SMALL",
    "distanceMeasureType": "DOT_PRODUCT_DISTANCE",
    "algorithmConfig": {
      "treeAhConfig": {
        "leafNodeEmbeddingCount": 1000,
        "leafNodesToSearchPercent": 10
      }
    }
  },
  "indexUpdateMethod": "STREAM_UPDATE"
}
```

You'll need an (empty) `contentsDeltaUri` GCS folder created beforehand.

## 2. Create the endpoint

```bash
gcloud ai index-endpoints create \
  --project=$VERTEX_PROJECT_ID \
  --region=$VERTEX_LOCATION \
  --display-name=watchmarks-endpoint \
  --public-endpoint-enabled
```

Note the resource ID — that's `VERTEX_INDEX_ENDPOINT_ID`.

## 3. Deploy the index to the endpoint

```bash
gcloud ai index-endpoints deploy-index $VERTEX_INDEX_ENDPOINT_ID \
  --project=$VERTEX_PROJECT_ID \
  --region=$VERTEX_LOCATION \
  --deployed-index-id=watchmarks_v1 \
  --display-name=watchmarks-v1 \
  --index=$VERTEX_INDEX_ID \
  --min-replica-count=1 \
  --max-replica-count=2
```

## 4. Wire the env vars into Cloud Functions

```bash
firebase functions:config:set vertex.project_id=$VERTEX_PROJECT_ID
firebase functions:config:set vertex.index_id=$VERTEX_INDEX_ID
firebase functions:config:set vertex.endpoint_id=$VERTEX_INDEX_ENDPOINT_ID
firebase functions:config:set vertex.deployed_index_id=watchmarks_v1
```

Or set as runtime env in `functions/.runtimeconfig.json` for local emulation.

## 5. Service-account permissions

The runtime service account (`...@appspot.gserviceaccount.com` for Firebase
Functions Gen 2) needs:

- `roles/aiplatform.user` (Vertex AI predictions + Vector Search read/write)
- existing `roles/datastore.user` (Firestore)
- existing `roles/secretmanager.secretAccessor` (for TMDB_API_KEY)

```bash
gcloud projects add-iam-policy-binding $VERTEX_PROJECT_ID \
  --member="serviceAccount:${VERTEX_PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## 6. Degraded mode

If any of these env vars is missing, the pipeline still runs:

- `fingerprint` stage returns keywords only (no embedding)
- `classify` falls back to a heuristic classifier
- `resolve` still hits TMDB via the existing client
- `searchBookmarks` falls back to keyword-only matching

This is intentional — it means a fresh clone can boot and the existing user
UI continues to function while infra is being provisioned.
