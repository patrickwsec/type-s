# Use Node.js as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files to the working directory
COPY package.json package-lock.json ./

# Install dependencies, including the missing ones
# Combining everything to optimize caching and avoid redundant installs
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Build the React app
RUN npm run build

# Install a static file server for the built app
RUN npm install -g serve

# Expose the port the app will run on
EXPOSE 3001

# Default to serving the built app. docker-compose overrides this to rebuild first.
CMD ["serve", "-s", "dist", "-l", "3001"]
