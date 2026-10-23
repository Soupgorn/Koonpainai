# Synthetic offsite tooling — deferred, no configured destination

The owner has approved **no destination** and accepts loss of disposable staging data only. Do not run these commands until a separate nonproduction destination is approved. This is not a production backup integration.

The existing portable backup system performs actual PostgreSQL snapshot/export/encryption/restore verification. This optional helper transfers only an already verified `reason: isolated` archive: `manifest.json` and `application.dump.enc`. The key never enters SCP/SSH, process arguments or the receipt. Retrieval needs a private locator, separate key and new destination; it does not need the source archive/database.

Prepare a private external JSON config only after approval. Required fields are `version:1`, a strict SSH alias, absolute restricted remote directory, source/destination machine-id SHA256 values (different), `approvedNonProduction:true` and `separateFailureDomainConfirmed:true`. Do not put passwords or connection strings in it. The destination must have Python3, host-key-pinned SSH access and a directory owned by the SSH account with0700 permissions, with no symlink ancestors. An operator must independently establish that this is a different failure domain; a different machine-id alone cannot prove that.

Example invocation with **placeholder paths**, not an active configuration:

```text
npx tsx scripts/offsite-backup.ts --config=/PRIVATE/offsite.json --backup=/PRIVATE/verified-isolated-archive --key-file=/SEPARATE/portable-key.json --receipt=/PRIVATE/new-delivery.json --approve-synthetic-offsite
npx tsx scripts/offsite-backup.ts --config=/PRIVATE/offsite.json --locator=/PRIVATE/new-delivery.json --key-file=/SEPARATE/portable-key.json --retrieve-to=/PRIVATE/new-recovery-archive --receipt=/PRIVATE/new-retrieval.json --approve-synthetic-offsite
```

The helper verifies local authenticated manifests/hashes, remote identity, file modes and exact ciphertext hashes; creates a unique destination with no overwrite; fsyncs files/receipt; then verifies the same locator hashes and authenticated archive after retrieval. Errors preserve partial artifacts for review instead of deleting or overwriting them. Five-minute transport bounds and noninteractive strict SSH checks prevent interactive password hangs. An interrupted receiver may leave a unique partial directory; inspect it and request scoped cleanup rather than automatically retrying in place.

Next restore that retrieved archive into a new isolated PostgreSQL instance using the portable restore command, deliver its key separately, and compare complete records/schema/ledger. Only then record actual offsite recovery. The current Windows/Linux helper tests use mocked SSH/SCP transport and are **not evidence that a real external destination was contacted**. The existing one-off Linux→Windows recovery evidence remains valid but does not establish an operational offsite service. Retention still reports candidates without deletion.
