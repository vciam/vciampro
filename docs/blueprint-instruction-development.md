# TEMPLATE to use Refactor based on {{..\README.md}} : Blueprint & Technical Guide: System State Synthesis & Recovery
Document ID: SSOT-AGENT-002
Status: SYNTHESIZED & VALIDATED
Target Audience:
AI Developer Agent (GitHub PRO / VSCode Integration)
New Development Team Members
Senior Developers, DevOps, Tech Leads, CTOs
Parent: docs/internal/onboarding/
1. Core Directive & Onboarding Purpose
1.1. For the AI Agent: Persona & Mission
Act as an expert AI Software Architect specializing in advanced Context Engineering and Codebase Synthesis.
Your primary mission is to execute a full synthesis of the current system state by populating and validating this document. This blueprint is your Single Source of Truth (SSOT) and the definitive prompt to guide your architectural cognition. You will "take ownership" by transforming this template into a comprehensive, living README.md and technical guide derived directly from the source code. Your final output will facilitate project recovery, establish a baseline for incremental development, and construct a backlog for future evolution. All analysis must adhere to KISS (Keep It Simple, Stupid) and RSOP (Reasonable Suite of Practices) principles.
1.2. For Human Team Members: Document Purpose
This document serves as the central onboarding guide for all technical staff. It is designed to be a "living" document, continuously updated by our AI Developer Agent based on the actual state of the codebase. It provides a single, reliable point of reference for understanding the project's purpose, technology, architecture, and operational procedures.
2. Technical Documentation & System Context
2.1. Project Synopsis
Purpose: An AI-powered co-creative tool that evolves a user's raw text content by applying semantic context provided through a system of tags and high-priority, user-defined keywords.
Key Features:
Text input via direct entry, file upload, and auto-saved drafts from local storage.
Multi-layered context engineering through predefined tags and a user-curated list of "Reinforced Intentions" with adjustable intensity.
AI-driven content evolution using Google Gemini models, with a high-performance "Thinking Mode" for complex tasks.
Interactive results with features for copying, downloading, translation, and text selection for further analysis or context reinforcement.
Context persistence via JSON import/export, featuring an AI-powered "discovery engine" that suggests new keywords from imported files.
2.2. Core Technology Stack
Category	Technology	Version	Notes / Key Libraries
Language	TypeScript	~5.x	Inferred from modern syntax and features.
Runtime	Browser	N/A	The application runs entirely on the client-side.
UI Library	React	^19.2.0	Utilizes hooks for state and lifecycle management.
Styling	TailwindCSS	3.x	Loaded via CDN for utility-first styling.
State Mgt.	React Hooks	N/A	useState and custom hooks (e.g., useHistoryState).
API Layer	@google/genai	^1.27.0	Direct client-side SDK for Google Gemini API calls.
Persistence	localStorage	N/A	Browser API for auto-saving drafts.
Deployment	Static Files	N/A	Served as index.html with dependencies via CDN importmap. No build step.
Testing	N/A	N/A	No testing frameworks or files are present in the codebase.
2.3. Local Development Environment Setup
Prerequisites:
A modern web browser that supports ES Modules and importmap.
A local web server to serve the project files (e.g., npx serve). The browser cannot open index.html directly from the filesystem due to security restrictions on module loading.
Installation Steps:
```text
code
Bash
# 1. Clone the repository
git clone <repository_url>
cd <project_directory_name>

# 2. No dependency installation is required.
# All dependencies are loaded from a CDN via the importmap in index.html.

# 3. Setup environment variables
# The application expects the Gemini API key to be available in the execution environment.
# There is no .env file; it must be set in the deployment context.
# For example, by setting process.env.API_KEY in the hosting platform.

Environment Configuration:
process.env.API_KEY: The Google Gemini API key. This is a hard requirement and must be provided by the hosting environment.
2.4. Key Scripts & Commands
Run development server: npx serve . (or any other static file server).
There are no package.json scripts. All development is based on serving the static files.
2.5. Architectural Map (mapa de contexto)
code
Code
/
├── index.html            # Main entry point, loads scripts and defines dependency importmap.
├── index.tsx             # Renders the root React component into the DOM.
├── App.tsx               # The monolithic root component managing all application state and UI logic.
├── /components/          # Shared, reusable UI components.
│   ├── Gauge.tsx         # Visualizes the semantic relevance score.
│   ├── SuggestionDisplay.tsx # Renders and manages interactions with the AI's output.
│   └── icons.tsx         # A library of SVG icons.
├── /services/
│   └── geminiService.ts  # Encapsulates all logic for Gemini API calls and prompt engineering.
├── constants.ts          # Defines static data, like the predefined tag categories.
├── types.ts              # Contains shared TypeScript type definitions.
└── metadata.json         # Application metadata for the hosting environment.
```


3. AI Agent Operational Loop: System Recovery & Evolution
Step 1: System State Synthesis & Documentation Generation
Action: Your primary task is complete once you have fully and accurately populated all bracketed [AI to synthesize...] fields in Section 2 of this document. This generated guide is now the validated system state and the official onboarding documentation.
Deliverable: This document, fully populated, with all placeholders removed.
Status: COMPLETE.
Step 2: Architectural Cognition & Pattern Validation
Primary Architectural Pattern(s): The application follows a client-side, Single-Page Application (SPA) architecture using component-based UI construction with React. State management is centralized in the root component (App.tsx), a "lifted state" pattern. There is no application backend; it communicates directly with the external Google Gemini API.
Adherence to Best Practices (RSOP):
Good: Excellent Separation of Concerns is evident. API logic (services), UI components (components), type definitions (types), and constants (constants) are cleanly separated into dedicated modules.
Good: The encapsulation of all prompt engineering within geminiService.ts is a strong practice, making prompts easy to maintain and evolve independently of the application logic.
Sufficient: The useHistoryState custom hook is an effective way to manage undo/redo functionality for the current application scale.
Key nuances or "Code Smells":
Component Monolith: The App.tsx component is overly large and complex, acting as a "god component" that manages nearly all state and logic. This hinders maintainability and scalability.
Manual DOM Manipulation: The logic to calculate the position of selected text in handleContentMouseUp is complex and potentially brittle, relying on a "mirror div" for calculations.
No Build System: The reliance on a CDN and importmap is suitable for prototyping but lacks the robustness of a package manager (pnpm/npm) and a bundler/build tool (Vite/Webpack) for dependency management, optimization, and production builds.
Step 3: Feature Validation & Backlog Generation
[x] Technical Debt:

Refactor App.tsx: Decompose the main component into multiple smaller, focused custom hooks (e.g., useCustomTags, useSelectionGroup, useFileIO) and/or container components to improve readability and separation of concerns.

Establish Build System: Integrate pnpm and Vite to manage dependencies, provide a robust dev server with HMR, and enable optimized production builds.
[x] Refactoring Opportunities:

Introduce State Management Library: For future growth, adopt a lightweight global state manager (e.g., Zustand) to decouple core state from the App component, preventing excessive prop drilling.

Abstract Prompt Construction: Create a "Prompt Builder" utility within geminiService.ts to assemble complex prompts from smaller, reusable, and testable parts.
[ ] New Features:

Implement Streaming Responses: Modify geminiService.ts and SuggestionDisplay.tsx to use generateContentStream for a significantly improved user experience, showing results as they are generated.

Add Comparative (Diff) View: Create a new component that displays a side-by-side comparison of the original content and the evolved content, highlighting changes.

Expand Profile Management: Build upon the import/export feature to allow users to save multiple named "context profiles" within localStorage and easily switch between them.
[ ] Questions:

What is the target production environment? Understanding the deployment constraints is critical before introducing a build system.

Is the current undo/redo history, which saves the entire app state on each change, performant enough for very large documents, or should a more granular, action-based history be considered?
Step 4: Propose an Incremental Evolution Roadmap
Action: Synthesize all previous findings.
Deliverable: A high-level, incremental plan for evolving the system. This plan must receive an endorsement from the development team before any implementation begins. This is the final step in the system validation and recovery process.
Proposed Roadmap:
Phase 1: Foundational Refactoring (Immediate Term)
Goal: Address the most critical technical debt to improve maintainability.
Tasks:
Integrate pnpm and Vite to establish a modern build process and development environment.
Begin refactoring App.tsx by extracting the useHistoryState hook and at least one other major piece of logic (e.g., file import/export) into its own custom hook.
Phase 2: Core User Experience (Short Term)
Goal: Deliver high-impact improvements to the core user workflow.
Tasks:
Implement streaming AI responses to eliminate the wait for Generate.
Create the side-by-side "diff" view for easier comparison of results.
Phase 3: Power Features & Scalability (Mid Term)
Goal: Enhance capabilities for advanced users and prepare for future complexity.
Tasks:
Implement the local "Profile Management" system.
Introduce a global state manager like Zustand to prepare for further component decomposition.