FROM elixir:1.15-alpine

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    nodejs \
    npm \
    inotify-tools \
    postgresql-client

# Create app directory
WORKDIR /app

# Install hex and rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Copy mix files
COPY mix.exs mix.lock ./

# Install dependencies
RUN mix deps.get && mix deps.compile

# Copy assets package files
COPY assets/package.json assets/package-lock.json ./assets/

# Install node dependencies
RUN cd assets && npm install && cd ..

# Copy all application files
COPY . .

# Expose port
EXPOSE 4000

# Start Phoenix server
CMD ["mix", "phx.server"]