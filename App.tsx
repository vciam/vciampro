import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TAG_CATEGORIES } from './constants';
import { getOrganizationSuggestions, discoverKeywordsFromText, refineSuggestions, analyzeAndSuggestContextualImprovements, translateText, analyzeSelectionGroup } from './services/geminiService';
import SuggestionDisplay from './components/SuggestionDisplay';
import { SparklesIcon, LoadingIcon, ErrorIcon, InfoIcon, FileUploadIcon, PlusIcon, XIcon, ExportIcon, CheckIcon, UndoIcon, RedoIcon, TrashIcon, LightBulbIcon, ClockIcon, ClipboardListIcon } from './components/icons';
import { TagCategory } from './types';
import Gauge from './components/Gauge';

// --- State Management Hook with History (Refactored for Stability) ---
const useHistoryState = <T,>(initialState: T) => {
    // FIX: Use a single state object to ensure atomic updates and prevent race conditions
    // between history and currentIndex, which was causing the "state is undefined" error.
    const [state, setState] = useState({ history: [initialState], currentIndex: 0 });

    const currentState = state.history[state.currentIndex];

    const setCurrentState = useCallback((action: T | ((prevState: T) => T)) => {
        setState(prevState => {
            const current = prevState.history[prevState.currentIndex];
            const newStateValue = typeof action === 'function' ? (action as (prevState: T) => T)(current) : action;
            const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
            newHistory.push(newStateValue);
            return {
                history: newHistory,
                currentIndex: prevState.currentIndex + 1
            };
        });
    }, []);

    const undoState = useCallback(() => {
        setState(prevState => {
            if (prevState.currentIndex > 0) {
                return { ...prevState, currentIndex: prevState.currentIndex - 1 };
            }
            return prevState;
        });
    }, []);

    const redoState = useCallback(() => {
        setState(prevState => {
            if (prevState.currentIndex < prevState.history.length - 1) {
                return { ...prevState, currentIndex: prevState.currentIndex + 1 };
            }
            return prevState;
        });
    }, []);
    
    const resetState = useCallback((newState: T) => {
        setState({ history: [newState], currentIndex: 0 });
    }, []);

    const canUndo = state.currentIndex > 0;
    const canRedo = state.currentIndex < state.history.length - 1;

    return [currentState, setCurrentState, undoState, redoState, canUndo, canRedo, resetState] as const;
};


interface AppState {
    content: string;
    selectedTags: Set<string>;
    customTags: { [key: string]: number };
    suggestions: string | null;
    keywords: string[];
    suggestionHistory: { prompt: string; suggestion: string }[];
    semanticScore: number;
    selectionGroup: string[];
}

const LOCAL_STORAGE_KEY = 'ai-content-organizer-draft';
const initialState: AppState = {
    content: '',
    selectedTags: new Set(),
    customTags: {},
    suggestions: null,
    keywords: [],
    suggestionHistory: [],
    semanticScore: 0,
    selectionGroup: [],
};

const REFINEMENT_TEMPLATES = [
    "Make this more concise",
    "Adopt a more formal tone",
    "Explain this to a beginner",
    "Add more technical detail",
    "Rephrase for a marketing audience"
];

type SaveStatus = 'idle' | 'saving' | 'saved';

const App: React.FC = () => {
    const [state, setState, undoState, redoState, canUndo, canRedo, resetState] = useHistoryState<AppState>(initialState);
    const { content, selectedTags, customTags, suggestions, keywords, suggestionHistory, semanticScore, selectionGroup } = state;

    // Ephemeral UI state, not part of history
    const [customTagInput, setCustomTagInput] = useState<string>('');
    const [isThinkingMode, setIsThinkingMode] = useState<boolean>(false);
    const [includeTagsInExport, setIncludeTagsInExport] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [popover, setPopover] = useState<{ top: number; left: number; text: string } | null>(null);
    const [isConfirmingAdd, setIsConfirmingAdd] = useState<false | 'intent' | 'group'>(false);
    const [justAddedTag, setJustAddedTag] = useState<string | null>(null);
    const [discoveredKeywords, setDiscoveredKeywords] = useState<string[]>([]);
    const [isDiscoveringKeywords, setIsDiscoveringKeywords] = useState<boolean>(false);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);
    const [refinementPrompt, setRefinementPrompt] = useState<string>('');
    const [isRefining, setIsRefining] = useState<boolean>(false);
    const [refinementError, setRefinementError] = useState<string | null>(null);
    const [isAnalyzingContext, setIsAnalyzingContext] = useState<boolean>(false);
    const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
    const [contextualAnalysisError, setContextualAnalysisError] = useState<string | null>(null);
    const [loadedProfileName, setLoadedProfileName] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [isAnalyzingGroup, setIsAnalyzingGroup] = useState<boolean>(false);
    const [groupAnalysisSuggestions, setGroupAnalysisSuggestions] = useState<string[]>([]);
    const [groupAnalysisError, setGroupAnalysisError] = useState<string | null>(null);

    const popoverRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);


    // --- Auto-Save and Load from Local Storage ---
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                const rehydratedState: AppState = {
                    content: parsed.content || '',
                    selectedTags: new Set(parsed.selectedTags || []),
                    customTags: parsed.customTags || {},
                    suggestions: parsed.suggestions || null,
                    keywords: parsed.keywords || [],
                    suggestionHistory: parsed.suggestionHistory || [],
                    semanticScore: parsed.semanticScore || 0,
                    selectionGroup: parsed.selectionGroup || [],
                };
                resetState(rehydratedState);
            }
        } catch (e) {
            console.error("Failed to load draft from local storage", e);
        }
    }, [resetState]);

    // Fix: Changed useRef<number>() to useRef<number | null>(null) for more explicit and robust initialization.
    const debouncedSave = useRef<number | null>(null);
    useEffect(() => {
        setSaveStatus('saving');
        if (debouncedSave.current) {
            window.clearTimeout(debouncedSave.current);
        }
        debouncedSave.current = window.setTimeout(() => {
            try {
                const serializableState = {
                    ...state,
                    selectedTags: Array.from(state.selectedTags),
                };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableState));
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (e) {
                console.error("Failed to save draft to local storage", e);
                setSaveStatus('idle'); // Or an 'error' state
            }
        }, 1000);
    }, [state]);

    // --- Keyboard shortcuts for Undo/Redo ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                 if (e.key === 'z') {
                    e.preventDefault();
                    if (canUndo) undoState();
                } else if (e.key === 'y') {
                    e.preventDefault();
                    if (canRedo) redoState();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undoState, redoState, canUndo, canRedo]);

    const handleTagToggle = useCallback((tag: string) => {
        setState(prev => {
            const newSet = new Set(prev.selectedTags);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return { ...prev, selectedTags: newSet };
        });
    }, [setState]);

    const handleCustomTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomTagInput(e.target.value);
    };
    
    const handleAddCustomTag = useCallback((tagToAdd?: string) => {
        const newTag = (tagToAdd || customTagInput).trim();
        if (newTag) {
            setState(prev => {
                const newCount = (prev.customTags[newTag] || 0) + 1;
                return { ...prev, customTags: { ...prev.customTags, [newTag]: newCount } };
            });
            if (tagToAdd) {
                flashAddedTag(newTag);
            }
            setCustomTagInput('');
        }
    }, [setState, customTagInput]);
    
    const handleRemoveCustomTag = useCallback((tagToRemove: string) => {
        setState(prev => {
            const newTags = { ...prev.customTags };
            delete newTags[tagToRemove];
            return { ...prev, customTags: newTags };
        });
    }, [setState]);

    const promoteTagToIntention = useCallback((tagToPromote: string) => {
        setState(prev => {
            // Remove from selectedTags
            const newSelectedTags = new Set(prev.selectedTags);
            newSelectedTags.delete(tagToPromote);

            // Add to customTags (or increment)
            const newCustomTags = { ...prev.customTags };
            const newCount = (newCustomTags[tagToPromote] || 0) + 1;
            newCustomTags[tagToPromote] = newCount;
            
            return { ...prev, selectedTags: newSelectedTags, customTags: newCustomTags };
        });
        flashAddedTag(tagToPromote); // Reuse existing flash effect
    }, [setState]);

    const flashAddedTag = (tag: string) => {
        setJustAddedTag(tag);
        setTimeout(() => setJustAddedTag(null), 1500);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setState(prev => ({ ...prev, content: text }));
            };
            reader.readAsText(file);
        }
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    const handleClearDraft = () => {
        if (window.confirm("Are you sure you want to clear your content and tags? This will also remove the auto-saved draft.")) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            resetState(initialState);
            setLoadedProfileName(null);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError("Please enter some content to analyze.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setState(prev => ({ ...prev, suggestions: null, keywords: [], semanticScore: 0 }));

        try {
            const result = await getOrganizationSuggestions(
                content,
                Array.from(selectedTags),
                customTags,
                isThinkingMode,
                suggestionHistory
            );
            setState(prev => ({ 
                ...prev, 
                suggestions: result.suggestions, 
                keywords: result.keywords, 
                semanticScore: result.semanticScore,
                suggestionHistory: [] 
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRefineSubmit = async () => {
        if (!refinementPrompt.trim() || !suggestions) {
            setRefinementError("Please enter a refinement instruction.");
            return;
        }

        setIsRefining(true);
        setRefinementError(null);

        try {
            const result = await refineSuggestions(
                suggestions,
                refinementPrompt,
                content,
                isThinkingMode
            );
            const newHistoryEntry = { prompt: refinementPrompt, suggestion: suggestions };
            setState(prev => ({ 
                ...prev, 
                suggestions: result.suggestions, 
                keywords: result.keywords,
                suggestionHistory: [...prev.suggestionHistory, newHistoryEntry]
            }));
            setRefinementPrompt('');
        } catch (err) {
            setRefinementError(err instanceof Error ? err.message : "An unknown error occurred during refinement.");
        } finally {
            setIsRefining(false);
        }
    };

    const handleRevertToVersion = (index: number) => {
        const historyEntry = suggestionHistory[index];
        const newCurrentSuggestion = historyEntry.suggestion;
        
        // The new history will be the items before the one we are reverting to.
        const newHistory = suggestionHistory.slice(0, index);

        // The item we are currently viewing goes back into the history
        const updatedHistory = [...newHistory, { prompt: "Current (Reverted From)", suggestion: suggestions! }];

        setState(prev => ({
            ...prev,
            suggestions: newCurrentSuggestion,
            suggestionHistory: updatedHistory
        }));
    };

    const handleExportKeywords = () => {
        const dataToExport = {
            customTags: customTags,
            ...(includeTagsInExport && { selectedTags: Array.from(selectedTags) })
        };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'context-keywords.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportKeywords = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target?.result as string;
                    const data = JSON.parse(text);
                    let currentCustomTags = { ...customTags };

                    if (data && typeof data === 'object') {
                        const newCustomTags = { ...customTags };
                        const newSelectedTags = new Set(selectedTags);
                        let updated = false;

                        // Universal compatibility for customTags (object with intensities or simple array)
                        if (typeof data.customTags === 'object' && data.customTags !== null) {
                            if (Array.isArray(data.customTags)) { // Handle older, simple array format
                                data.customTags.forEach((tag) => {
                                    if (typeof tag === 'string') {
                                        newCustomTags[tag] = (newCustomTags[tag] || 0) + 1;
                                        updated = true;
                                    }
                                });
                            } else { // Handle new object with intensity format
                                for (const tag in data.customTags) {
                                    if (Object.prototype.hasOwnProperty.call(data.customTags, tag)) {
                                        const intensity = Number(data.customTags[tag]);
                                        if (!isNaN(intensity)) {
                                            newCustomTags[tag] = (newCustomTags[tag] || 0) + intensity;
                                            updated = true;
                                        }
                                    }
                                }
                            }
                        }

                         if (Array.isArray(data.selectedTags)) {
                            // FIX: Add type guard to ensure only strings are added to the Set, preventing type pollution.
                            data.selectedTags.forEach(tag => {
                                if (typeof tag === 'string') {
                                    newSelectedTags.add(tag)
                                }
                            });
                            updated = true;
                        }

                        if(updated) {
                            setState(prev => ({...prev, customTags: newCustomTags, selectedTags: newSelectedTags }));
                            currentCustomTags = newCustomTags;
                        }

                        // Set the loaded profile name for UI feedback
                        setLoadedProfileName(file.name);

                        const textBlocks = [ data.content, data.suggestions, ...(data.keywords || Object.keys(currentCustomTags))];
                        const textToAnalyze = textBlocks.filter(Boolean).join('\n\n');
                        const fullContext = {
                            fullText: textToAnalyze,
                            // FIX: Ensure tags are strings, as the source Set might be polluted from state.
                            tags: Array.from(newSelectedTags).filter((tag): tag is string => typeof tag === 'string'),
                            customTags: newCustomTags
                        };

                        // Reset previous discovery/analysis results
                        setDiscoveredKeywords([]);
                        setDiscoveryError(null);
                        setContextualSuggestions([]);
                        setContextualAnalysisError(null);

                        if (textToAnalyze.trim()) {
                            // --- AI Layer 1: Discover Keywords ---
                            setIsDiscoveringKeywords(true);
                            try {
                                const discovered = await discoverKeywordsFromText(textToAnalyze);
                                const newDiscoveries = discovered.filter(k => !Object.prototype.hasOwnProperty.call(currentCustomTags, k));
                                setDiscoveredKeywords(newDiscoveries);
                            } catch (err) {
                                setDiscoveryError(err instanceof Error ? err.message : 'Failed to discover keywords.');
                            } finally {
                                setIsDiscoveringKeywords(false);
                            }

                            // --- AI Layer 2: 5 Whys Analysis for Conceptual Suggestions ---
                            setIsAnalyzingContext(true);
                             try {
                                const conceptual = await analyzeAndSuggestContextualImprovements(fullContext);
                                const newConcepts = conceptual.filter(k => !Object.prototype.hasOwnProperty.call(currentCustomTags, k));
                                setContextualSuggestions(newConcepts);
                            } catch (err) {
                                setContextualAnalysisError(err instanceof Error ? err.message : 'Failed to analyze context.');
                            } finally {
                                setIsAnalyzingContext(false);
                            }
                        }
                    }
                } catch (err) {
                    setError("Failed to import keywords. Please check the file format.");
                    setLoadedProfileName(null);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; 
        }
    };

    const handleAddDiscoveredKeyword = (keyword: string) => {
        handleAddCustomTag(keyword);
        setDiscoveredKeywords(prev => prev.filter(k => k !== keyword));
    };
    
    const handleAddContextualSuggestion = (keyword: string) => {
        handleAddCustomTag(keyword);
        setContextualSuggestions(prev => prev.filter(k => k !== keyword));
    };

    const handleTextSelect = useCallback((text: string, rect: DOMRect) => {
        if (text.trim()) {
            setPopover({
                top: window.scrollY + rect.top - 40,
                left: window.scrollX + rect.left + (rect.width / 2),
                text: text,
            });
        }
    }, []);
    
    const handleContentMouseUp = () => {
        const textarea = contentTextareaRef.current;
        if (!textarea) return;

        const { selectionStart, selectionEnd } = textarea;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd).trim();

        if (selectedText) {
            // Create a mirror div to calculate selection position
            const mirrorDiv = document.createElement('div');
            const style = window.getComputedStyle(textarea);
            const propsToCopy = [
                'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
                'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                'textAlign', 'textTransform', 'wordSpacing', 'whiteSpace',
                'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing'
            ];
            propsToCopy.forEach((prop) => {
                mirrorDiv.style[prop as any] = style[prop as any];
            });

            mirrorDiv.style.position = 'absolute';
            mirrorDiv.style.top = '0';
            mirrorDiv.style.left = '-9999px'; // Position off-screen
            mirrorDiv.style.visibility = 'hidden';
            mirrorDiv.style.height = 'auto';
            mirrorDiv.style.minHeight = '0';
            mirrorDiv.style.overflow = 'hidden'; // Important for correct height calculation

            const textBefore = textarea.value.substring(0, selectionStart);
            const textSelected = textarea.value.substring(selectionStart, selectionEnd);
            
            mirrorDiv.textContent = textBefore;
            const span = document.createElement('span');
            span.textContent = textSelected;
            mirrorDiv.appendChild(span);

            document.body.appendChild(mirrorDiv);
            
            const textareaRect = textarea.getBoundingClientRect();
            const spanRect = span.getBoundingClientRect();

            const popoverTop = textareaRect.top + (spanRect.top - mirrorDiv.getBoundingClientRect().top) - textarea.scrollTop;
            const popoverLeft = textareaRect.left + (spanRect.left - mirrorDiv.getBoundingClientRect().left) + (spanRect.width / 2) - textarea.scrollLeft;
            
            document.body.removeChild(mirrorDiv);
            
            setPopover({
                top: popoverTop - 40, // offset for the popover height
                left: popoverLeft,
                text: selectedText
            });
        }
    };


    const handleAddFromPopover = () => {
        if (popover) {
            handleAddCustomTag(popover.text);
            setIsConfirmingAdd('intent');
            setTimeout(() => {
                setPopover(null);
                setIsConfirmingAdd(false);
            }, 1000);
        }
    };
    
    const handleAddToGroupFromPopover = () => {
        if (popover) {
            if (!selectionGroup.includes(popover.text)) {
                 setState(prev => ({ ...prev, selectionGroup: [...prev.selectionGroup, popover.text] }));
            }
            setIsConfirmingAdd('group');
            setTimeout(() => {
                setPopover(null);
                setIsConfirmingAdd(false);
            }, 1000);
        }
    };

    const handleClearGroup = () => {
        setState(prev => ({ ...prev, selectionGroup: [] }));
        setGroupAnalysisSuggestions([]);
        setGroupAnalysisError(null);
    };

    const handleAnalyzeGroup = async () => {
        if (selectionGroup.length === 0) return;
        setIsAnalyzingGroup(true);
        setGroupAnalysisSuggestions([]);
        setGroupAnalysisError(null);
        try {
            const results = await analyzeSelectionGroup(selectionGroup);
            setGroupAnalysisSuggestions(results);
        } catch (err) {
            setGroupAnalysisError(err instanceof Error ? err.message : 'Failed to analyze selection.');
        } finally {
            setIsAnalyzingGroup(false);
        }
    };
    
    const handleAddGroupSuggestion = (suggestion: string) => {
        handleAddCustomTag(suggestion);
        setGroupAnalysisSuggestions(prev => prev.filter(s => s !== suggestion));
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                const selection = window.getSelection();
                if (!selection || selection.toString().trim() === '') {
                     setPopover(null);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [popoverRef]);

    const getTagIntensityClass = (count: number): string => {
        if (count >= 4) return 'bg-purple-600 text-white font-bold ring-2 ring-purple-400 shadow-lg shadow-purple-500/50';
        if (count === 3) return 'bg-indigo-500 text-indigo-100 font-semibold ring-1 ring-indigo-400 shadow-md shadow-indigo-500/40';
        if (count === 2) return 'bg-sky-600 text-sky-100 ring-1 ring-sky-500';
        return 'bg-indigo-600/70 text-indigo-200';
    };

    const renderTagCategory = (category: TagCategory) => (
        <div key={category.title}>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">{category.title}</h3>
            <div className="flex flex-wrap gap-2">
                {category.tags.map(tag => {
                    // Do not render the tag if it has been promoted to a custom tag
                    if (Object.prototype.hasOwnProperty.call(customTags, tag)) {
                        return null;
                    }
                    const isSelected = selectedTags.has(tag);
                    return (
                        <button
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors ${
                                isSelected
                                    ? 'bg-teal-500 text-white font-semibold'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }`}
                        >
                            {tag}
                            {isSelected && (
                                <span 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        promoteTagToIntention(tag);
                                    }}
                                    className="p-0.5 rounded-full hover:bg-white/20"
                                    title="Reinforce this tag with higher priority"
                                >
                                    <PlusIcon className="h-3 w-3" />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
    
    const SaveStatusIndicator: React.FC = () => {
        let text = '';
        if (saveStatus === 'saving') text = 'Saving...';
        if (saveStatus === 'saved') text = 'Draft Saved';
        if (!text) return null;

        return (
            <div className="text-xs text-gray-400 transition-opacity duration-500">
                {text}
            </div>
        );
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
             {popover && (
                <div ref={popoverRef} className="absolute z-20" style={{ top: `${popover.top}px`, left: `${popover.left}px`, transform: 'translateX(-50%)' }}>
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full shadow-lg p-1">
                        <button onClick={handleAddFromPopover} className={`p-2 rounded-full text-white transition-all duration-300 hover:scale-110 ${isConfirmingAdd === 'intent' ? 'bg-green-500' : 'bg-teal-600 hover:bg-teal-500'}`} title={`Add "${popover.text}" to intentions`}>
                            {isConfirmingAdd === 'intent' ? <CheckIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
                        </button>
                        <button onClick={handleAddToGroupFromPopover} className={`p-2 rounded-full text-white transition-all duration-300 hover:scale-110 ${isConfirmingAdd === 'group' ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500'}`} title={`Add "${popover.text}" to selection group`}>
                             {isConfirmingAdd === 'group' ? <CheckIcon className="h-5 w-5" /> : <ClipboardListIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            )}
            <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                         <h1 className="text-2xl font-bold text-gray-100 flex items-center">
                            <SparklesIcon className="h-6 w-6 mr-2 text-teal-400" />
                            AI Content Organizer
                        </h1>
                        <SaveStatusIndicator />
                    </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => undoState()} disabled={!canUndo} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
                            <UndoIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => redoState()} disabled={!canRedo} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)">
                            <RedoIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="content-input" className="block text-lg font-medium text-gray-300 mb-2">
                                Your Content
                            </label>
                            <div className="relative">
                                <textarea
                                    ref={contentTextareaRef}
                                    id="content-input"
                                    value={content}
                                    onChange={(e) => setState(prev => ({ ...prev, content: e.target.value }))}
                                    onMouseUp={handleContentMouseUp}
                                    placeholder="Paste or type your content here... or upload a file."
                                    className="w-full h-64 p-4 bg-gray-800 border border-gray-700 rounded-lg resize-y focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                                />
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                     <button onClick={handleClearDraft} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Clear content and saved draft">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                    <button onClick={triggerFileUpload} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Upload a text file">
                                        <FileUploadIcon className="h-5 w-5" />
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.text" className="hidden" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-medium text-gray-300">Context Tags</h2>
                            {TAG_CATEGORIES.map(renderTagCategory)}
                        </div>
                        
                        <div>
                           <div className="flex justify-between items-center mb-2">
                                <label htmlFor="custom-tags-input" className="block text-lg font-medium text-gray-300">
                                    Reinforce Your Intention
                                </label>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="import-keywords" className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors cursor-pointer" title="Import keywords and tags from a .json file">
                                        <FileUploadIcon className="h-5 w-5" />
                                        <input id="import-keywords" type="file" onChange={handleImportKeywords} accept=".json" className="hidden" />
                                    </label>
                                    <button onClick={handleExportKeywords} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Export reinforced keywords and selected tags to a .json file">
                                        <ExportIcon className="h-5 w-5" />
                                    </button>
                                </div>
                           </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="custom-tags-input"
                                    type="text"
                                    value={customTagInput}
                                    onChange={handleCustomTagChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                                    placeholder="Add a high-priority keyword"
                                    className="flex-grow p-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                                />
                                <button onClick={() => handleAddCustomTag()} className="p-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors" title="Add Keyword">
                                    <PlusIcon className="h-6 w-6" />
                                </button>
                            </div>
                             <div className="mt-2">
                                <label className="flex items-center text-sm text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={includeTagsInExport} onChange={(e) => setIncludeTagsInExport(e.target.checked)} className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 text-teal-500 rounded focus:ring-teal-500" />
                                    <span className="ml-2">Include selected context tags in export</span>
                                </label>
                            </div>
                            {loadedProfileName && (
                                <div className="flex items-center justify-between p-3 mt-3 bg-teal-900/50 border border-teal-700 rounded-lg text-teal-200">
                                    <p className="text-sm">
                                        <span className="font-bold">`Developer Agent` Profile Loaded:</span> {loadedProfileName}
                                    </p>
                                    <button onClick={() => setLoadedProfileName(null)} className="p-1 rounded-full hover:bg-teal-700/80" title="Dismiss">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            {Object.keys(customTags).length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {Object.entries(customTags).map(([tag, count]) => (
                                        <span key={tag} className={`flex items-center px-3 py-1 text-sm rounded-full transition-all duration-300 ${getTagIntensityClass(Number(count))} ${justAddedTag === tag ? 'animate-pulse' : ''}`}>
                                            {tag} {Number(count) > 1 && <span className="ml-1.5 text-xs font-bold opacity-80">x{Number(count)}</span>}
                                            <button onClick={() => handleAddCustomTag(tag)} className="ml-2 p-0.5 rounded-full hover:bg-black/20" title={`Increase intensity for "${tag}"`}>
                                                <PlusIcon className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => handleRemoveCustomTag(tag)} className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-black/20" title={`Remove "${tag}"`}>
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {(isDiscoveringKeywords || discoveryError || discoveredKeywords.length > 0) && (
                                <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-md font-semibold text-gray-300">Discovered Keywords from Import</h3>
                                        <button onClick={() => { setDiscoveredKeywords([]); setDiscoveryError(null); }} className="p-1 rounded-full hover:bg-gray-700" title="Dismiss">
                                            <XIcon className="h-4 w-4 text-gray-400" />
                                        </button>
                                    </div>
                                    {isDiscoveringKeywords && (
                                        <div className="flex items-center text-gray-400">
                                            <LoadingIcon className="h-5 w-5 mr-2 animate-spin" />
                                            <span>Analyzing for keywords...</span>
                                        </div>
                                    )}
                                    {discoveryError && <div className="text-red-400 text-sm"><p>{discoveryError}</p></div>}
                                    {discoveredKeywords.length > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400 mb-2">Click to add these suggested keywords:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {discoveredKeywords.map(keyword => (
                                                    <button key={keyword} onClick={() => handleAddDiscoveredKeyword(keyword)} className="flex items-center px-3 py-1 bg-sky-600/20 text-sky-300 text-sm rounded-full hover:bg-sky-600/40 transition-colors" title={`Add "${keyword}"`}>
                                                        <PlusIcon className="h-4 w-4 mr-1.5" />
                                                        {keyword}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                             {(isAnalyzingContext || contextualAnalysisError || contextualSuggestions.length > 0) && (
                                <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-md font-semibold text-gray-300 flex items-center"><LightBulbIcon className="h-5 w-5 mr-2 text-yellow-400" /> Conceptual Suggestions</h3>
                                        <button onClick={() => { setContextualSuggestions([]); setContextualAnalysisError(null); }} className="p-1 rounded-full hover:bg-gray-700" title="Dismiss">
                                            <XIcon className="h-4 w-4 text-gray-400" />
                                        </button>
                                    </div>
                                    {isAnalyzingContext && (
                                        <div className="flex items-center text-gray-400">
                                            <LoadingIcon className="h-5 w-5 mr-2 animate-spin" />
                                            <span>Performing deep analysis...</span>
                                        </div>
                                    )}
                                    {contextualAnalysisError && <div className="text-red-400 text-sm"><p>{contextualAnalysisError}</p></div>}
                                    {contextualSuggestions.length > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400 mb-2">AI analysis suggests these high-level concepts to reinforce your intent. Click to add:</p>
                                             <div className="flex flex-wrap gap-2">
                                                {contextualSuggestions.map(keyword => (
                                                    <button key={keyword} onClick={() => handleAddContextualSuggestion(keyword)} className="flex items-center px-3 py-1 bg-yellow-600/20 text-yellow-300 text-sm rounded-full hover:bg-yellow-600/40 transition-colors" title={`Add "${keyword}"`}>
                                                        <PlusIcon className="h-4 w-4 mr-1.5" />
                                                        {keyword}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {suggestions && semanticScore > 0 && (
                                    <Gauge score={semanticScore} />
                                )}
                                <label htmlFor="thinking-mode-toggle" className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" id="thinking-mode-toggle" className="sr-only" checked={isThinkingMode} onChange={(e) => setIsThinkingMode(e.target.checked)} />
                                        <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${isThinkingMode ? 'transform translate-x-6 bg-teal-400' : ''}`}></div>
                                    </div>
                                    <div className="ml-3 text-gray-300">
                                        Thinking Mode
                                    </div>
                                </label>
                                <div className="relative group ml-2">
                                    <InfoIcon className="h-5 w-5 text-gray-400" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-64 p-2 mb-2 text-xs text-white bg-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                        Enable for deeper, more nuanced analysis of complex content. Uses the gemini-2.5-pro model.
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="flex items-center justify-center px-6 py-3 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <LoadingIcon className="h-5 w-5 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="h-5 w-5 mr-2" />
                                        Generate
                                    </>
                                )}
                            </button>
                        </div>

                        {selectionGroup.length > 0 && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-semibold text-gray-100">Selection Group ({selectionGroup.length})</h3>
                                    <button onClick={handleClearGroup} className="text-sm text-teal-400 hover:text-teal-300 hover:underline">
                                        Clear Group
                                    </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 border-l-2 border-gray-700 pl-4">
                                    {selectionGroup.map((snippet, index) => (
                                        <div key={index} className="bg-gray-700/50 p-2 rounded text-sm text-gray-300 italic">
                                            "{snippet}"
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <button onClick={handleAnalyzeGroup} disabled={isAnalyzingGroup} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isAnalyzingGroup ? (
                                            <>
                                                <LoadingIcon className="h-5 w-5 mr-2 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <LightBulbIcon className="h-5 w-5 mr-2" />
                                                Analyze Selection for Core Theme
                                            </>
                                        )}
                                    </button>
                                </div>
                                {groupAnalysisError && <p className="text-red-400 text-sm mt-2">{groupAnalysisError}</p>}
                                {groupAnalysisSuggestions.length > 0 && (
                                    <div className="bg-teal-900/50 border border-teal-700 rounded-lg p-4 space-y-3">
                                        <p className="text-teal-200 text-sm font-semibold">AI Suggested Core Themes:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {groupAnalysisSuggestions.map((suggestion) => (
                                                <button 
                                                    key={suggestion}
                                                    onClick={() => handleAddGroupSuggestion(suggestion)} 
                                                    className="flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors bg-teal-500 text-white font-semibold hover:bg-teal-400" 
                                                    title={`Add "${suggestion}" to intentions`}
                                                >
                                                    <PlusIcon className="h-4 w-4" /> {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center">
                                <ErrorIcon className="h-5 w-5 mr-3" />
                                <p>{error}</p>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full h-full flex flex-col items-center justify-center text-gray-400">
                                <LoadingIcon className="h-10 w-10 animate-spin mb-4" />
                                <p className="text-lg">AI is evolving your content...</p>
                                <p className="text-sm">This may take a moment, especially in Thinking Mode.</p>
                            </div>
                        ) : suggestions ? (
                            <>
                                <SuggestionDisplay
                                    suggestions={suggestions}
                                    keywords={keywords}
                                    originalContent={content}
                                    originalTags={Array.from(selectedTags)}
                                    originalCustomTags={customTags}
                                    semanticScore={semanticScore}
                                    selectionGroup={selectionGroup}
                                    onTextSelect={handleTextSelect}
                                    onAddKeyword={handleAddCustomTag}
                                />
                                {/* Third Layer: Refinement */}
                                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-gray-100 mb-3">Third Layer: Refine Suggestions</h3>
                                    <div className="mb-3">
                                        <p className="text-sm text-gray-400 mb-2">Prompt Template Likes:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {REFINEMENT_TEMPLATES.map(template => (
                                                <button 
                                                    key={template}
                                                    onClick={() => setRefinementPrompt(template)}
                                                    className="px-3 py-1 bg-indigo-600/30 text-indigo-300 text-sm rounded-full hover:bg-indigo-600/50 transition-colors"
                                                >
                                                    {template}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={refinementPrompt}
                                            onChange={(e) => setRefinementPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRefineSubmit()}
                                            placeholder="e.g., Make this more concise"
                                            className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                                            disabled={isRefining}
                                        />
                                        <button onClick={handleRefineSubmit} disabled={isRefining} className="flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            {isRefining ? <LoadingIcon className="h-5 w-5 animate-spin" /> : "Refine"}
                                        </button>
                                    </div>
                                    {refinementError && <p className="text-red-400 text-sm mt-2">{refinementError}</p>}
                                    
                                    {suggestionHistory.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-md font-semibold text-gray-300 mb-2 flex items-center"><ClockIcon className="h-5 w-5 mr-2" /> Refinement History</h4>
                                            <ul className="space-y-2">
                                                {suggestionHistory.slice().reverse().map((item, index) => {
                                                    const originalIndex = suggestionHistory.length - 1 - index;
                                                    return (
                                                        <li key={originalIndex} className="p-2 bg-gray-700/50 rounded-md text-sm text-gray-400 flex justify-between items-center">
                                                            <span>Refined with: "{item.prompt}"</span>
                                                            <button onClick={() => handleRevertToVersion(originalIndex)} className="text-xs text-teal-400 hover:text-teal-300 hover:underline">
                                                                Revert to this version
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full h-full flex flex-col items-center justify-center text-center text-gray-400">
                                <SparklesIcon className="h-12 w-12 mb-4 text-gray-500" />
                                <h2 className="text-xl font-semibold mb-2">Ready to Evolve Your Content</h2>
                                <p>Your refined text will appear here once you generate it.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;