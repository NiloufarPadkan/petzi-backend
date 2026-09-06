#!/bin/sh
set -e

# Named volumes mount over the image's uploads/ tree and are root-owned by
# default. Ensure the non-root app user can write profile pictures / docs.
mkdir -p /app/uploads/profile-pictures /app/uploads/pet-documents
chown -R petzi:petzi /app/uploads

exec runuser -u petzi -- "$@"
