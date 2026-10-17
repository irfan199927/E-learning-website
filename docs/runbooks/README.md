# Runbooks

Step-by-step guides for operating E-learner. They assume the UAT setup in [../uat.md](../uat.md) (Docker Compose on
a VM, `deploy/uat/manage.sh`); production on AWS isn't built yet ([../deployment.md](../deployment.md)).

| Runbook                                        | Use it when                                                   |
| ---------------------------------------------- | ------------------------------------------------------------- |
| [incident-response.md](incident-response.md)   | Something is broken or a data leak is suspected: start here   |
| [recording-sync.md](recording-sync.md)         | A class ended but its recording never showed up in the course |
| [transcode-failures.md](transcode-failures.md) | A video is stuck "processing" or failed                       |
| [google-reconnect.md](google-reconnect.md)     | A teacher sees "Reconnect Google" or classes stop syncing     |
| [payments.md](payments.md)                     | Checking UPI payments students reported                       |
| [restore-database.md](restore-database.md)     | Backups, and restoring the database                           |
| [rotate-secrets.md](rotate-secrets.md)         | A secret leaked, or routine rotation                          |

Shortcuts used below (run on the UAT VM as the `elearner` user from `/opt/elearner/app`):

```bash
deploy/uat/manage.sh logs worker          # follow worker logs (or: logs web)
deploy/uat/manage.sh status
docker compose -f deploy/uat/compose.yaml exec -T postgres psql -U elearner elearner   # SQL shell
```
