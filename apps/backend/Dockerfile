# RPS backend image. Build from this folder:
#   docker build -t rps-backend apps/backend
# Holds: the server (default command), the seed (`rps-seed`), the migrations and the `migrate` tool.
# Database changes are a separate step, run before the new server starts:
#   migrate -path /app/migrations -database "$DATABASE_URL" up

# ───── Build ─────
FROM golang:1.25-alpine AS build
WORKDIR /src

# Same golang-migrate version as on the development machine.
RUN CGO_ENABLED=0 go install -tags postgres -ldflags "-s -w" \
    github.com/golang-migrate/migrate/v4/cmd/migrate@v4.17.0

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/rps-server ./cmd/server \
 && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/rps-seed ./cmd/seed

# ───── Run ─────
FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
 && adduser -D -H -u 10001 rps \
 && mkdir -p /data/uploads \
 && chown rps:rps /data/uploads

COPY --from=build /out/rps-server /out/rps-seed /go/bin/migrate /usr/local/bin/
COPY migrations /app/migrations

# Rework photos are written here. Mount storage that outlives the container at /data/uploads,
# or the photos are lost on every redeploy.
ENV ENV=production \
    PORT=8080 \
    UPLOAD_DIR=/data/uploads
VOLUME /data/uploads

WORKDIR /app
USER rps
EXPOSE 8080
CMD ["rps-server"]
