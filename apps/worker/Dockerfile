FROM golang:1.25.7-trixie AS builder
WORKDIR /workspace/apps/worker

COPY apps/worker/go.mod apps/worker/go.sum ./
RUN go mod download

COPY apps/worker ./
RUN go build -o /out/worker ./

FROM debian:trixie-slim AS runner
WORKDIR /app

ENV TZ=Asia/Shanghai

COPY --from=builder /out/worker /usr/local/bin/zhblogs-worker

EXPOSE 9301
CMD ["zhblogs-worker"]
