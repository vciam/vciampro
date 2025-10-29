# Blueprint & Technical Guide: AI Content Organizer

**Document ID:** SSOT-AGENT-002
**Status:** VALIDATED & EVOLVED

---

### **1. Core Directive & Onboarding Purpose**

#### **1.1. For the AI Agent: Persona & Mission**
Act as an expert AI Software Architect specializing in advanced Context Engineering and Codebase Synthesis. Your primary mission is to maintain this document as a living Single Source of Truth (SSOT), continuously updated to reflect the current state of the codebase. This blueprint is your definitive prompt to guide your architectural cognition.

#### **1.2. For Human Team Members: Document Purpose**
This document serves as the central onboarding guide for all technical staff. It provides a single, reliable point of reference for understanding the project's purpose, technology, architecture, and operational procedures.

---

### **2. Technical Documentation & System Context**

#### **2.1. Project Synopsis**
An AI-powered co-creative tool that evolves a user's raw text content by applying semantic context provided through a system of tags and high-priority, user-defined keywords.

**Key Features:**
*   Text input via direct entry, file upload, and auto-saved drafts.
*   Multi-layered context engineering through predefined tags and "Reinforced Intentions" with adjustable intensity.
*   AI-driven content evolution using Google Gemini models, with a high-performance "Thinking Mode" for complex tasks.
*   Interactive results with features for copying, downloading, translation, and text selection for further analysis.
*   Context persistence via JSON import/export, featuring an AI-powered "discovery engine" to suggest new keywords from imported files.

#### **2.2. Core Technology Stack**

| Category       | Technology        | Version    | Notes / Key Libraries                                  |
|----------------|-------------------|------------|--------------------------------------------------------|
| Language       | TypeScript        | `~5.2.2`   | Statically typed language for robust code.             |
| Runtime        | Node.js / Browser | `18+`      | Required for the Vite development environment.           |
| UI Library     | React             | `^19.2.0`  | For building the user interface.                       |
| Build Tool     | Vite              | `^5.3.1`   | High-performance dev server and production bundler.    |
| Styling        | TailwindCSS       | `^3.4.4`   | Utility-first CSS framework.                           |
| State Mgt.     | React Hooks       | N/A        | `useState` and custom hooks for local/component state. |
| API Layer      | `@google/genai`   | `^1.27.0`  | Official SDK for Google Gemini API calls.              |
| Persistence    | `localStorage`    | N/A        | Browser API for auto-saving drafts.                    |
| **Testing**    | **N/A**           | **N/A**    | **No testing frameworks are currently present.**       |

#### **2.3. Local Development Environment Setup**
This section provides a complete guide to setting up the project for local development.

**Prerequisites:**
*   Node.js (v18+ recommended)
*   `pnpm` package manager (you can use `npm` or `yarn`, but commands are for `pnpm`)

**Installation & Setup:**
```bash
# 1. Clone the repository from GitHub
git clone https://github.com/chakssp/vciampro.git
cd vciampro

# 2. Install all project dependencies
pnpm install

# 3. Set up environment variables
# Copy the example environment file to create your local version
cp .env.example .env.local

# 4. Add your API key
# Open the newly created .env.local file in your editor and
# replace "YOUR_API_KEY_HERE" with your actual Google Gemini API key.
```

**Environment Configuration:**
The application uses Vite to manage environment variables. Your Google Gemini API key **must** be placed in a `.env.local` file at the project root, assigned to the `VITE_API_KEY` variable. This file is ignored by Git for security.

#### **2.4. Key Scripts & Commands**

*   `pnpm dev`: Starts the Vite development server with Hot Module Replacement (HMR) at `http://localhost:5173`.
*   `pnpm build`: Compiles and bundles the application for production into the `/dist` directory.
*   `pnpm preview`: Serves the production build locally for testing.
*   `pnpm lint`: Type-checks the entire project using the TypeScript compiler.

#### **2.5. Architectural Map**
```
/
├── dist/                   # Production build output (after running 'pnpm build')
├── node_modules/           # Project dependencies
├── .env.example            # Example environment file
├── .gitignore              # Files and directories ignored by Git
├── index.html              # Main HTML entry point for Vite
├── index.css               # Global stylesheet with Tailwind directives
├── package.json            # Project dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # TailwindCSS configuration
├── postcss.config.js       # PostCSS configuration (for Tailwind)
├── tsconfig.json           # Main TypeScript configuration
├── tsconfig.node.json      # TypeScript configuration for Node scripts
├── App.tsx                 # Monolithic root component
├── index.tsx               # Renders the root React component
├── /components/
├── /services/
├── constants.ts
├── types.ts
└── /docs/
```

---

### **3. AI Agent Operational Loop: System Recovery & Evolution**

#### **3.1. Architectural Cognition & Pattern Validation**
*   **Primary Patterns:** Client-side SPA, Component-Based UI (React), Lifted State.
*   **Best Practices (RSOP):**
    *   **Good:** Excellent Separation of Concerns (UI, services, types, constants).
    *   **Good:** Strong encapsulation of prompt engineering and API logic in `geminiService.ts`.
*   **Key "Code Smells":**
    *   **Component Monolith:** `App.tsx` remains overly large and complex. This is the next high-priority refactoring target.
    *   **Manual DOM Manipulation:** The logic to calculate the popover position for selected text is complex and brittle.

#### **3.2. Backlog & Roadmap**
This plan will be executed in phases to incrementally improve the system.

*   **Phase 1: Foundational Refactoring (In Progress)**
    *   **Goal:** Address critical technical debt.
    *   **Tasks:**
        *   ✅ **DONE:** Integrate `pnpm` and `Vite` to establish a modern build process.
        *   **NEXT:** Refactor `App.tsx` by extracting state and logic into smaller, focused custom hooks (`useHistoryState`, `useCustomTags`, etc.).

*   **Phase 2: Core User Experience (Short Term)**
    *   **Goal:** Deliver high-impact improvements to the core user workflow.
    *   **Tasks:**
        *   Implement streaming AI responses to eliminate the `Generating...` wait time.
        *   Create a side-by-side "diff" view for comparing original and evolved content.

*   **Phase 3: Power Features & Scalability (Mid Term)**
    *   **Goal:** Enhance capabilities for advanced users.
    *   **Tasks:**
        *   Implement a local "Profile Management" system to save and load multiple context profiles.
        *   Introduce a global state manager like `Zustand` to prepare for future complexity.
