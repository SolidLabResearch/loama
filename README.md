# Loama

![Crest](https://github.com/user-attachments/assets/b083b4d0-f655-4385-9a6e-08c632b860b7)

This repository contains multiple projects. To get them running, go through them individually

## Controller `./controller`

The base functionality for...

## Loama `./loama`

The access management app

## Mockbook `./mockbook`

A first demo application to showcase Loama.
MockBook is a social network that allows users to view their posts and friends.

**Data**

- profile: name, email, bio, profile picture
- posts: text, image, video
- friends: list of friends

## Doctorapp `./doctorapp`

A second demo application to showcase Loama.
DoctorApp is a medical app that allows you to view your doctor appointments.

**Data**

- information: name, email, phone number
- appointments: date, time

## solid-common-lib `./solid-common-lib`

All common functionalities across controller, loama, or (demo) applications

## solid-app-lib `./solid-app-lib`

All common functionalities across (demo) applications,
relies on solid-common-lib.

## Getting started

### Prerequisites

- Node >= 20
- Yarn >= 1.22.x

### Environment variables

The apps are configurable by means of some environment variables.

The environment variables are read from `.env[.mode]` files as [documented by Vite](https://v2.vitejs.dev/config/#environment-variables).

Each app has a file `.env.example` showing the possibilities.
You may copy it to e.g. `.env` in the same directory and modify it to your needs.

One environment variable is common to all apps: `VITE_BASE`, allowing to run the app in a URL with a path.
The loama `.env.example` file would result in the loama app running at e.g. `http://localhost:5173/loama/`.
Very useful for running this app behind a reverse proxy!

### Development setup

We use yarn workspaces to manage our dependencies of all the subprojects.

Run `yarn` or `yarn install` to get all the dependencies.

Do this before starting loama a very first time after installation:

```bash
# terminate all yarn dev commands below with <Ctrl-C> as soon as they display "Found 0 errors. Watching for file changes."
cd ./solid-common-lib/
yarn dev
cd ../solid-app-lib/
yarn dev
cd ../controller/
yarn dev
```

To start the dev server for loama and its dependencies:

```bash
yarn dev
```

This makes use of [nx](https://nx.dev) to run a job in multiple projects.

Now you can find loama at <http://localhost:5173>, or in a URL with a path, if you configured so in your `.env` as explained above.

### Using your own SOLID pod

1. `mkdir -p css/data`: The CSS uses filesystem-based storage
2. `docker compose up -d --wait`

This will spin up a Community Solid Server on port 3000.
