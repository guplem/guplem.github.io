## Task
Your task is to add a new project to my work list.

## Description Structure
### Structure:
1. **Project Name & Concept** 
	- Briefly describe the project’s main idea or purpose. 
	- Mention the product type (e.g., mobile app, web app, game, etc.).

	**Example:** 
	*DishForge* is an **AI-powered cooking app** that generates personalized recipes based on user preferences.

2. **Role & Responsibilities** 
	- State your role (e.g., front-end developer, team lead). 
	- Summarize the key tasks you worked on.

	**Example:** 
	As the **front-end developer**, I designed the **UI**, integrated **APIs**, and ensured smooth user interaction with AI features.

3. **Outcome or Impact** 
	- Briefly mention the result of the project (e.g., improvements, performance, user feedback).

	**Example:** 
	Delivered in **48 hours**, the app demonstrated fast development and effective AI integration.

### Key Points:
- Keep descriptions **short and direct**.
- Focus on **your role** and **your work**.
- Highlight **outcomes** or **impacts** (e.g., efficiency, innovation).


## The New Project

The project is called “Web App Template.” It is accessible in GitHub:https://github.com/guplem/robo-base

The goal of the project was to provide a simple and efficient starting point for building web applications that supported many commonly required features. These apps can be hosted either in the cloud or locally by the developer, and are designed to be easily accessible and usable from virtually any user and device with access to a web browser through a simpleURL.

To achieve this, I chose to use RoboJS with Vite and React. This combination enables the creation of lightweight, browser-based apps that require minimal setup. The template also supports building APIs within the same project, integrating a database, scheduling tasks, and synchronizing client state in real time — all with a low learning curve.

The template includes:

Clear documentation and usage examples for all key features

Step-by-step instructions for creating new projects

A simple deployment guide using Docker and Google Cloud, with a process that can be adapted to other cloud platforms

The following is the README.md file included in the template. Use it to extract any relevant and useful information to create a complete summary of this project:
```markdown
# robo-base
A base project for creating an easily-deployable WebApp using [RoboJS](https://robojs.dev/).

> Note: This README provides step-by-step instructions for setting up and deploying a RoboJS WebApp using the `main` branch. 

> For a fully implemented example showcasing additional RoboJS features, see the `sync-web-app` branch. That branch is referenced multiple times in this README as it contains simple bug functional examples of the features discussed here. It can also be used as a starting point for your own project.

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or newer
- [npm](https://www.npmjs.com/)
- A [Google Cloud Platform (GCP)](https://console.cloud.google.com/) account and [GCP CLI](https://cloud.google.com/sdk/docs/install) (for deployment)

## Setup

> Only reqiored if you are starting a new project using the `main` branch.

1. Fork this repository or use it as a template for your own project.

2. Clone your repository to your computer and navigate to its directory.

3. Create a new project using the RoboJS CLI. Replace `<projectName>` with your desired project name:

	npx create-robo <projectName> && mv <projectName>/* . ; rmdir -r <projectName>


4. Select *Web Application* as the project type.

5. Enable the following features for the project:
	- *TypeScript*
	- *React*
	- *Prettier*
	- *ESLint*
	> See linting documentation [here](https://robojs.dev/robojs/linting).

	> The *opinionated* configuration of *Prettier* and *ESLint* is bundled with this project. You can remove it or customize it later if needed by altering the `.prettierrc`, `.prettierignore` and `eslint.config.mjs` files.

6. Enable *Sync* if your project requires state synchronization between clients.

	> For more details, see the [Synchronization of State between Clients](#synchronization-of-state-between-clients) section.

> At the end, you may see a few warnings about moving files after running the command. These can be safely ignored.

### Configuring Path Aliases

> Only reqiored if you are starting a new project using the `main` branch.

To avoid having to use relative paths in your imports, you can set up path aliases for your project. This allows you to use non-relative imports like `import { MyComponent } from '@/components/MyComponent'` instead of `import { MyComponent } from '../../components/MyComponent'`.

1. In `tsconfig.json`, update `compilerOptions`:
		
		{
			"compilerOptions": {
				// ...existing code...
				"baseUrl": ".",
				"paths": {
					"@/*": ["src/*"]
				}
			}
		}
		

2. In `config/vite.mjs`, under `resolve.alias`:

		import path from 'path'
		// ...existing code...
		resolve: {
			alias: {
				'@': path.resolve(__dirname, '../src')
			}
		}


> You can see an example of this in [this commit](https://github.com/guplem/robo-base/commit/99f6a70849d39d664121a4b1b75453178a64015c).

### Environment Variables

You can create a `.env` file in the root directory of your project to set environment variables. This file is ignored by Git, so it won't be pushed to your repository.

The default `.env` file created by the RoboJS CLI contains the following variables:

# Enable source maps for easier debugging
NODE_OPTIONS="--enable-source-maps"

# Change this port number if needed
PORT="3000"


## Development Mode and Local Hosting

Start the development server with hot reloading:

> Make sure you have run `npm install` before starting the development server.


npm run dev


After running the command:
- The server will start at `http://localhost:3000/`.
- An external tunnel will be created (the URL will appear in the console). This allows you to test on other devices or share the server with others.

> If you want to run it using Docker, you can use `docker build -t robo-app .; docker run -p 3000:3000 robo-app`.

## Deployment

### Google Cloud

This project is pre-configured for automatic deployment to Google Cloud Run using a custom build process defined in `cloudbuild.yaml`.

1. In the file located at `config\plugins\robojs\server.ts`, add the `hostname` parameter to the server configuration with the value `0.0.0.0`:

	export default {
			cors: true,
			hostname: '0.0.0.0'
			// other options...
	}


2. Update the `_SERVICE_NAME` variable in the `cloudbuild.yaml` file (under the *substitutions* section) to a recognizable name. This name will be used to create the Cloud Run service (e.g., "project-name-service").

3. Create a new project in the [Google Cloud Console](https://console.cloud.google.com).

4. Select the project in the top bar of the GCP console.

5. Enable the [Artifact Registry API](https://console.cloud.google.com/artifacts).

6. Install the [GCP CLI](https://cloud.google.com/sdk/docs/install) and verify the installation:

	gcloud --version


7. Log in to your GCP account:

	gcloud auth login


8. Set the project ID in your terminal:

	gcloud config set project <project-id>

	> You can find the project ID in the [GCP console](https://console.cloud.google.com/welcome).

9. Create a repository in Artifact Registry:

	gcloud artifacts repositories create cloud-run-source-deploy --repository-format=docker --location=europe-southwest1 --description="Docker repository for Cloud Run deployments"


	> You can change the location to your preferred region. The example above uses `europe-southwest1`.

10. Enable the [Cloud Build Triggers API](https://console.cloud.google.com/cloud-build/triggers).

11. Create a Cloud Build trigger:
	- Click "Connect Repository".
	- Link your GitHub account to GCP and grant access to the repository by selecting "*Edit repositories on GitHub*".
	- After selecting the repository, choose *Create a trigger*.
	- Set a name (e.g., "project-name-deploy").
	- In the *Source* section, specify the branch to trigger builds from (the default is `main`).
	- In the *Configuration* section, choose "Cloud Build configuration file (YAML or JSON)".
	- Set the location to *Repository* and the path to `cloudbuild.yaml` (this is probably already set by default).
	- Select a service account.
	- Click "Create".

12. Set up the service account with the necessary permissions:
	- Go to the [IAM & Admin](https://console.cloud.google.com/iam-admin/iam) page.
	- Find the service account you selected in the previous step (it should have a name like `something@something.gserviceaccount.com`).
	- Click the pencil icon to edit the service account.
	- *Add* the following role: `Cloud Run Admin`.
	- Click "Save".

13. Trigger the first build:
		- Go to the [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers) page.
		- Click the "Run" button next to the trigger you just created.

		> Alternatively, you can push a commit to the branch you specified in the trigger settings. This will automatically trigger a build.

The build process will automatically:
- Create a Cloud Run service with your specified name if it doesn't exist
- Configure it with public access (allow unauthenticated invocations)
- Enable cold boot capabilities (CPU throttling when idle)
- Set maximum CPU scaling to 3 CPUs

### Manual Deployment
To trigger a manual deployment, run:

gcloud builds submit --config=cloudbuild.yaml


## Working with RoboJS Plugins
Use [RoboJS's plugin system](https://robojs.dev/plugins/directory) to add functionality through plugins. Here are some useful plugins:

### Synchronization of State between Clients
Use [@robojs/sync](https://robojs.dev/plugins/sync) to share state in real time between clients.

The `useSyncState` hook creates a state synchronized between clients. The state can be shared across all clients or within a specific subset of clients:

import { useSyncState } from '@robojs/sync';

// For state shared across all clients
const [sharedState, setSharedState] = useSyncState<boolean>(false, ['uniqueId']);

// For state scoped to a room (group of clients)
const [roomState, setRoomState] = useSyncState<string>('', ['uniqueId', roomId]);


Do not forget to wrap your app with the `SyncContextProvider` as shown [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/index.tsx).

> An example implementation of this feature can be found [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/counter/Page.tsx).

#### Providing synchronized state to the component tree
You can provide the synchronized state to the component tree using the [React Context API](https://react.dev/reference/react/createContext). This enables access to the synchronized state from any component within the tree.

> You can see an example of how to define the context [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/counter/Context.ts), how to provide it [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/counter/Page.tsx) and how to consume it [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/counter/Controls.tsx)

### Scheduling Tasks
Use [@robojs/cron](https://robojs.dev/plugins/cron) to schedule jobs at specific intervals or times.

> Install the plugin with `npx robo add @robojs/cron`.

You can schedule a job to run when your Robo starts by creating `src/events/_start.ts`:

import { Cron } from '@robojs/cron';

export default (): void => {
		Cron('*/10 * * * * *', (): void => {
				// This job runs every 10 seconds!
		});
};


> The `Cron` constructor returns a job object that can be used to pause, resume, stop, or get the next run time.

See also how to [use a separate file for your job logic](https://robojs.dev/plugins/cron#job-file) and how to [persist jobs across server restarts](https://robojs.dev/plugins/cron#job-file).

> An example implementation of this feature can be found [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/events/_start.ts).

## Working with RoboJS's core features
RoboJS provides a powerful set of features to enhance your application. Note that most core features are only available on the backend (server-side), not in the browser (client-side, e.g., `src/app`).

> Avoid importing from `robo.js` in the frontend. Instead, expose backend functionality via API endpoints.

Some utilities, like the [Logger](https://robojs.dev/robojs/logger), can be used in the browser by importing the subpath:


import { logger } from 'robo.js/logger.js';

logger.info('This message is logged from the browser (client)!');


For other backend state or features, create API endpoints in `src/api` and fetch them from your frontend. See the [Playground Demo](https://robojs.dev/playground) for examples.

> As discussed [here](https://discord.com/channels/1087134933908193330/1365947805180629022/1366169583198670951), this avoids bundling Node‑specific code into the browser build.

### API
Robo comes bundled with [@robojs/server](https://robojs.dev/plugins/server), a simple server for creating and managing API endpoints.

Creating a new endpoint is as simple as creating a new file in the `src/api` directory. The file name will be used as the endpoint path, and the exported function will handle incoming requests:

export default async (request: Request): Promise<Response> => {
		const urlParams: URLSearchParams = new URLSearchParams(request.url.split('?')[1] ?? '');
		const userId: string | null = urlParams.get('userId');

		return new Response(
				JSON.stringify({
						message: 'This is a JSON response',
						userId: userId,
				}),
				{
						status: 200,
				},
		);
};


> Multiple example implementations of this feature can be found [here](https://github.com/guplem/robo-base/tree/sync-web-app/src/api).

### Database
Robo comes bundled with [Flashcore Database](https://robojs.dev/robojs/flashcore), a key-value pair database. It is a simple and fast database for storing data accessible from all clients. While not a full-fledged database, it is useful for small amounts of data.


import { Flashcore } from 'robo.js';
import type { CommandInteraction } from 'discord.js';

export default async (interaction: CommandInteraction): Promise<string> => {
		const userId: string = interaction.user.id;

		const score: number | undefined = await Flashcore.get<number>(userId);
		return score
				? `High score is: ${score}!`
				: 'No high score yet! 🎮';
};

> An example implementation of this feature can be found [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/api/room.ts).

> **Note:** Flashcore does not persist data outside the container. If the container restarts (e.g., due to cold‑boot), all data is lost. To persist, use a Keyv adapter (MySQL, MongoDB, etc.).

Flashcore also allows [watching for changes](https://robojs.dev/robojs/flashcore#watching-for-changes) in the database with the `Flashcore.on(...)` method, and you can stop watching with `Flashcore.off(...)`.

If it is desired to persist data, Flashcore accepts [Keyv Adapters](https://robojs.dev/robojs/flashcore#using-keyv-adapters), allowing you to use, for instance [MySQL](https://github.com/jaredwray/keyv/tree/main/packages/mysql) or [MongoDB](https://github.com/jaredwray/keyv/tree/main/packages/mongo).

### State Management
Use [Robo's state management](https://robojs.dev/robojs/state) to temporarily store data in server (backend) memory. This is useful for storing data that doesn't need to persist across server restarts.

> Alternatively, you can use Flashcore without a Keyv adapter to store data in memory.

#### Client-side State Management
If you need client-side state management you can also use [Zustand](https://github.com/pmndrs/zustand) (or any other state management library like Redux, MobX, etc. or simply React's built-in state management: `useState` and `useReducer`).

This is an example of a simple Zustand *store* that manages a counter:

import { create } from 'zustand';

type CounterStore = {
	count: number;
	increment: () => void;
};

export const useCounterStore = create<CounterStore>((set): CounterStore => ({
	count: 0,
	increment: (): void => set((state) => ({ count: state.count + 1 })),
}));


> Tip: To persist your store across page reloads, use Zustand’s `persist` middleware:

> An example implementation of the store can be found [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/room/store.ts) and its usage can be found in many places such as [here](https://github.com/guplem/robo-base/blob/sync-web-app/src/app/modules/room/Page.tsx).

## Other Features
Check out the [RoboJS documentation](https://robojs.dev/) for more information on available [plugins](https://robojs.dev/plugins) and [core features](https://robojs.dev/robojs/overview).

Another useful feature is [Running Mode](https://robojs.dev/robojs/mode), which lets you select the `.env` file to use. This helps separate development, testing, and production configurations.

And many more! **Be sure to explore the available [plugins](https://robojs.dev/plugins) and [features](https://robojs.dev/robojs/overview) in RoboJS.**

```