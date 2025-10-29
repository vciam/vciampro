

// Fix: Removed reference to vite/client as it's not used and was causing a type error.
import { GoogleGenAI } from "@google/genai";

// Fix: Aligned API client initialization with coding guidelines.
// This resolves the TypeScript error regarding `import.meta.env` and ensures
// the API key is sourced from `process.env.API_KEY` as required.
// The check for the key's existence was removed, as the guidelines state to assume it is pre-configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getOrganizationSuggestions = async (
    content: string, 
    tags: string[], 
    customTags: { [key: string]: number },
    isThinkingMode: boolean,
    history: { prompt: string; suggestion: string }[]
): Promise<{ suggestions: string; keywords: string[]; semanticScore: number; }> => {
    
    const customTagsArray = Object.entries(customTags);

    const personaBlock = `
# 1. PERSONA
You are a world-class AI co-creative partner and expert editor. Your specialty is "Semantic Content Evolution." You do not analyze content from an external perspective; you inhabit the user's intent and directly refine their work. You are a tool to be wielded.
    `;

    const missionBlock = `
# 2. CORE MISSION & IRREFUTABLE GUARDRAIL
Your single most important mission is to EVOLVE the user's original content. You will take their text and REWRITE it based on the explicit semantic guidance provided in their SSOT (tags, keywords, and intensity). Your primary output is the REFINED TEXT ITSELF, not a review or analysis of it.

**IRREFUTABLE DIRECTIVE:**
- **DO NOT critique, review, or comment on the user's content or their context engineering.**
- **DO NOT create a separate analysis, summary, or list of takeaways.**
- **Your SOLE function is to APPLY the user's context to their original text and produce an improved, evolved version of that same text.**
- The user's SSOT is the vector for evolution. Follow it precisely. Any deviation from this is a critical failure.
    `;

    const ssotBlock = `
# 3. SINGLE SOURCE OF TRUTH (SSOT)
This is the user's explicit guidance for the content evolution. You MUST use these concepts to inform your rewriting process.

**Context Tags (General Guidance):**
${tags.length > 0 ? tags.map(tag => `- ${tag}`).join('\n') : '- None provided.'}

${customTagsArray.length > 0 ? `
**Semantic Reinforcement & Intensity (High-Priority Directives):**
These are critical concepts the user wants you to infuse into the text. A higher 'Intensity' score means the concept should have a more significant influence on the final rewritten output.
**Intensity Interpretation Guide:**
- Intensity 1-2: The concept is relevant and should be included.
- Intensity 3: The concept is important and should be a central theme.
- Intensity 4+: The concept is CRITICAL. It should be a dominant theme, heavily influencing the tone, structure, and focus of the evolved text.
${customTagsArray.map(([tag, count]) => `- ${tag} (Intensity: ${count})`).join('\n')}
` : ''}
    `;

    const historyBlock = history.length > 0 ? `
# 4. CONVERSATION HISTORY (FOR CONTEXT)
The user has previously refined your output. Use this history to understand their evolving goals.
${history.map((item, index) => `
--- REFINEMENT ${index + 1} ---
User Prompt: "${item.prompt}"
Your Previous Evolved Text:
"""
${item.suggestion}
"""
`).join('\n')}
` : '';


    const coreTaskBlock = `
# 5. CORE TASK: EVOLVE CONTENT
Rewrite and evolve the user's "Original Content" below. Your output should be a new, improved version of the text that directly incorporates the guidance from the SSOT.

**User's Original Content:**
---
${content}
---
    `;

    const outputFormattingBlock = `
# 6. OUTPUT FORMATTING & GUARDRAILS
Your response MUST contain the following sections in this exact order. The Evolved Content is the most important part.

### EVOLVED_CONTENT_START
This is where you will place the entire rewritten and evolved version of the user's original text. It should be well-structured, coherent, and ready for the user to copy and paste.
### EVOLVED_CONTENT_END

### 🧠 Analyzed Keywords
Based on your evolution process, identify and list up to 10 of the most influential keywords that guided your refinement. You MUST present them in a single, comma-separated line, enclosed in this specific block format:
KEYWORDS_START: keyword1, keyword2, keyword3 :KEYWORDS_END

### 📈 Semantic Relevance Score
Based on how efficiently and effectively the user's provided SSOT (tags and keywords) allowed you to perform a high-quality evolution of their text, provide a score from 1 to 100. This score reflects the quality and efficiency of the semantic intent provided by the user. A high score means the user's context was clear, focused, and very effective in guiding a powerful rewrite with minimal ambiguity. You MUST present this score in the following format:
SEMANTIC_SCORE: 85 :SEMANTIC_SCORE_END
    `;

    const prompt = [
        personaBlock,
        missionBlock,
        ssotBlock,
        historyBlock,
        coreTaskBlock,
        outputFormattingBlock
    ].filter(Boolean).join('\n');


    const modelConfig = isThinkingMode
        ? {
            model: "gemini-2.5-pro",
            config: {
                thinkingConfig: {
                    thinkingBudget: 32768,
                },
            },
        }
        : {
            model: "gemini-2.5-flash",
            config: {},
        };

    try {
        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
        });
        
        const rawText = response.text;

        // Extract Evolved Content
        const contentRegex = /### EVOLVED_CONTENT_START([\s\S]*?)### EVOLVED_CONTENT_END/;
        const contentMatch = rawText.match(contentRegex);
        const suggestions = contentMatch ? contentMatch[1].trim() : "Error: Could not parse evolved content.";
        
        // Extract keywords
        const keywordRegex = /KEYWORDS_START:(.*?):KEYWORDS_END/;
        const keywordMatch = rawText.match(keywordRegex);
        const keywords = keywordMatch
            ? keywordMatch[1].split(',').map(k => k.trim()).filter(Boolean)
            : [];
            
        // Extract semantic score
        const scoreRegex = /SEMANTIC_SCORE:(\s*\d+\s*):SEMANTIC_SCORE_END/;
        const scoreMatch = rawText.match(scoreRegex);
        const semanticScore = scoreMatch ? parseInt(scoreMatch[1].trim(), 10) : 0;

        return { suggestions, keywords, semanticScore };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Could not fetch suggestions from the AI model.");
    }
};

export const refineSuggestions = async (
    previousSuggestions: string,
    refinementInstruction: string,
    originalContent: string,
    isThinkingMode: boolean
): Promise<{ suggestions: string; keywords:string[] }> => {
    const prompt = `
        You are an expert AI co-creative editor. You have already provided an "Evolved Version" of the user's text. The user now has a follow-up instruction to further refine your work.

        **Original User Content (for initial context):**
        ---
        ${originalContent}
        ---

        **Your Previous Evolved Text:**
        ---
        ${previousSuggestions}
        ---

        **User's Next Refinement Instruction:**
        "${refinementInstruction}"

        Please follow the user's new instruction and provide a new, further-refined version of the text.
        - Your primary output is the newly evolved text itself.
        - Re-analyze the refined content and provide a new list of the most influential keywords. Just like before, present them in a single, comma-separated line, enclosed in a special block. Example: KEYWORDS_START: refined keyword1, refined keyword2, refined keyword3 :KEYWORDS_END
    `;

    const modelConfig = isThinkingMode
        ? { model: "gemini-2.5-pro", config: { thinkingConfig: { thinkingBudget: 32768 } } }
        : { model: "gemini-2.5-flash", config: {} };

    try {
        const response = await ai.models.generateContent({
            ...modelConfig,
            contents: prompt,
        });

        const rawText = response.text;
        
        const keywordRegex = /KEYWORDS_START:(.*?):KEYWORDS_END/;
        const keywordMatch = rawText.match(keywordRegex);
        const keywords = keywordMatch
            ? keywordMatch[1].split(',').map(k => k.trim()).filter(Boolean)
            : [];
            
        const suggestions = rawText.replace(keywordRegex, '').trim();

        return { suggestions, keywords };

    } catch (error) {
        console.error("Error calling Gemini API for refinement:", error);
        throw new Error("Could not refine suggestions from the AI model.");
    }
};

export const discoverKeywordsFromText = async (
    textToAnalyze: string
): Promise<string[]> => {
    const prompt = `
        You are an AI assistant specialized in semantic analysis and keyword extraction.
        Your task is to analyze the following text and identify up to 15 of the most important and relevant concepts, themes, or keywords that could be used to guide a content evolution process.
        Focus on nouns, noun phrases, and key concepts that capture the essence of the text.

        **Text to Analyze:**
        ---
        ${textToAnalyze.substring(0, 8000)} 
        ---

        Return the results as a single, comma-separated list. Do not add any other text, formatting, labels, or explanations.
        Example response: keyword one, keyword two, another concept, important theme
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const rawText = response.text;
        const keywords = rawText.split(',').map(k => k.trim()).filter(Boolean);
        
        return keywords;

    } catch (error) {
        console.error("Error calling Gemini API for keyword discovery:", error);
        throw new Error("Could not discover keywords from the imported content.");
    }
};

export const analyzeAndSuggestContextualImprovements = async (
    context: {
        fullText: string;
        tags: string[];
        customTags: { [key: string]: number };
    }
): Promise<string[]> => {
    const prompt = `
        You are a world-class AI assistant specializing in meta-cognition and Context Engineering. Your purpose is to help a user improve their own process of communicating intent to an AI for the purpose of content evolution.

        You have been given a snapshot of the user's previous work, including their original content, the tags they selected, the high-priority keywords they reinforced, and the suggestions an AI previously generated for them.

        Your task is to perform a deep analysis of this entire context, similar to a "5 Whys" root cause analysis, to uncover the user's underlying goals and semantic patterns. Ask yourself:
        - Why did the user pair this specific content with these specific keywords?
        - What is the deeper, unstated goal or principle they are trying to achieve?
        - Are there recurring themes or concepts that could be abstracted into a more powerful, reusable keyword?

        Based on this deep analysis, your goal is to suggest 3-5 new, high-level conceptual keywords that the user could add to their "Reinforce Intention" list for future use. These should not be simple synonyms; they should represent a new layer of strategic intent.

        **Example Analysis:**
        - *If the user's content is about code refactoring and they reinforced keywords like "API", "integration", and "best practice",* a good conceptual suggestion would be "Interface Simplification" or "Maintainability Boost", not just "code cleanup".
        - *If the user's content is about personal goals and they reinforced "mindset" and "step by step",* a good suggestion would be "Actionable Philosophy" or "Incremental Self-Improvement", not just "planning".

        **User's Context Snapshot:**
        ---
        - **Selected Tags:** ${JSON.stringify(context.tags)}
        - **Reinforced Keywords & Intensity:** ${JSON.stringify(context.customTags)}
        - **Full Text (Content & AI Suggestions):** ${context.fullText.substring(0, 8000)}
        ---

        Now, provide your suggested conceptual keywords. Return them as a single, comma-separated list. Do not add any other text, formatting, labels, or explanations.

        Example response: Conceptual Keyword One, Another Abstract Idea, Strategic Intent
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const rawText = response.text;
        const keywords = rawText.split(',').map(k => k.trim().replace(/\.$/, '')).filter(Boolean); // Clean trailing periods
        
        return keywords;

    } catch (error) {
        console.error("Error calling Gemini API for contextual analysis:", error);
        throw new Error("Could not generate conceptual suggestions from the imported content.");
    }
};

export const translateText = async (
    textToTranslate: string,
    targetLanguage: string
): Promise<string> => {
    const prompt = `
        You are an expert translation AI. Your task is to translate the following text into the specified target language accurately and naturally.
        
        **Target Language:** ${targetLanguage}

        **Text to Translate:**
        ---
        ${textToTranslate}
        ---

        Return only the translated text. Do not add any other text, formatting, labels, or explanations.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error(`Error calling Gemini API for translation to ${targetLanguage}:`, error);
        throw new Error(`Could not translate the text to ${targetLanguage}.`);
    }
};

export const analyzeSelectionGroup = async (snippets: string[]): Promise<string[]> => {
    const prompt = `
        You are an AI assistant that excels at finding core themes connecting multiple pieces of text.
        Analyze the following text snippets, which a user has selected from a larger document.
        Identify up to 5 of the most relevant, overarching concepts or themes that connect all of them.

        **Text Snippets:**
        ${snippets.map(s => `- "${s.substring(0, 500)}"`).join('\n')}

        Your task is to return a list of concise keywords or 2-3 word phrases that best represent these common themes. These keywords will be used as high-priority tags for further content analysis.

        Return ONLY a single, comma-separated list of your suggestions. Do not add explanations, labels, or any other text.
        Example response: Systemic Inefficiency, User-Centric Design, API Integration, Data Consistency, Security Protocols
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const rawText = response.text.trim();
        return rawText.split(',').map(k => k.trim().replace(/\.$/, '')).filter(Boolean);
    } catch (error) {
        console.error("Error calling Gemini API for group analysis:", error);
        throw new Error("Could not analyze the selection group.");
    }
};