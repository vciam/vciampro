import React, { useState } from 'react';
import { DownloadIcon, ExportIcon, CopyIcon, CheckIcon, TranslateIcon, LoadingIcon, DiffIcon } from './icons';
import Gauge from './Gauge'; 
import { translateText } from '../services/geminiService';
import DiffView from './DiffView';

interface SuggestionDisplayProps {
    suggestions: string;
    keywords: string[];
    originalContent: string;
    originalTags: string[];
    originalCustomTags: { [key: string]: number };
    semanticScore: number;
    selectionGroup: string[];
    onTextSelect: (text: string, rect: DOMRect) => void;
    onAddKeyword: (keyword: string) => void;
}

const SuggestionDisplay: React.FC<SuggestionDisplayProps> = ({ 
    suggestions, 
    keywords, 
    originalContent, 
    originalTags, 
    originalCustomTags,
    semanticScore,
    selectionGroup,
    onTextSelect,
    onAddKeyword
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationError, setTranslationError] = useState<string | null>(null);
    const [translatedContent, setTranslatedContent] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(false);

    const handleDownload = () => {
        const contentToDownload = translatedContent || suggestions;
        const blob = new Blob([contentToDownload], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-evolved-content.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyToClipboard = () => {
        const contentToCopy = translatedContent || suggestions;
        navigator.clipboard.writeText(contentToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleExport = () => {
        const exportData = {
            content: originalContent,
            tags: originalTags,
            customTags: originalCustomTags,
            evolvedContent: suggestions,
            keywords: keywords,
            semanticScore: semanticScore
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        // Fix: Declare the anchor element 'a' before using it.
        const a = document.createElement('a');
        a.href = url;
        a.download = 'content-evolution.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
        const selection = window.getSelection();
        if (event.currentTarget.contains(selection?.anchorNode) && selection && selection.toString().trim()) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            onTextSelect(selection.toString().trim(), rect);
        }
    };

    const handleTranslate = async () => {
        setIsTranslating(true);
        setTranslationError(null);
        try {
            const result = await translateText(suggestions, 'Brazilian Portuguese');
            setTranslatedContent(result);
        } catch (err) {
            setTranslationError(err instanceof Error ? err.message : 'Translation failed.');
        } finally {
            setIsTranslating(false);
        }
    };

    const getHighlightIntensityClass = (count: number): string => {
        if (count >= 4) return 'bg-purple-600/30 text-purple-200 font-semibold px-1 rounded';
        if (count === 3) return 'bg-indigo-500/30 text-indigo-200 font-semibold px-1 rounded';
        if (count === 2) return 'bg-sky-600/30 text-sky-200 px-1 rounded';
        return 'bg-indigo-600/20 text-indigo-300 px-1 rounded';
    };


    const renderMarkdown = (text: string) => {
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Highlight reinforced keywords
        const reinforcedKeywords = Object.keys(originalCustomTags);
        if(reinforcedKeywords.length > 0) {
            // Sort by length descending to match longer phrases first
            reinforcedKeywords.sort((a, b) => b.length - a.length);
            const regex = new RegExp(`(${reinforcedKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
            html = html.replace(regex, (match) => {
                const lowerCaseMatch = match.toLowerCase();
                // Find the original keyword (case-insensitive) to get the correct intensity
                const originalKeyword = reinforcedKeywords.find(k => k.toLowerCase() === lowerCaseMatch);
                const intensity = originalKeyword ? originalCustomTags[originalKeyword] : 1;
                return `<span class="${getHighlightIntensityClass(intensity)}">${match}</span>`;
            });
        }
        
        // Highlight selection group
        if(selectionGroup.length > 0) {
            selectionGroup.sort((a, b) => b.length - a.length);
            const selectionRegex = new RegExp(`(${selectionGroup.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
            html = html.replace(selectionRegex, (match) => {
                // Avoid wrapping already highlighted content's tags
                if (match.startsWith('<span')) return match;
                return `<span class="border-b-2 border-yellow-400 border-dotted">${match}</span>`;
            });
        }

        // Basic markdown for structure within the evolved content
        html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mb-2 mt-4 text-gray-100">$1</h3>');
        html = html.replace(/^\s*[-*] (.*$)/gim, '<li class="list-disc ml-6">$1</li>');
        html = html.replace(/((<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        
        // Replace newlines with <br>
        html = html.replace(/\n/g, '<br />');

        // Clean up extra <br> tags around block elements
        html = html.replace(/<br \/>\s*<h3/g, '<h3');
        html = html.replace(/<\/h3><br \/>/g, '</h3>');
        html = html.replace(/<br \/>\s*<li/g, '<li');
        html = html.replace(/<\/li><br \/>/g, '</li>');
        html = html.replace(/<br \/>\s*<\/ul/g, '</ul');

        return { __html: html };
    };
    
    const displayedContent = translatedContent || suggestions;

    return (
        <div data-suggestion-display className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full h-full overflow-y-auto space-y-6">
            <div className="flex justify-between items-start">
                <div>
                     <h2 className="text-2xl font-bold text-gray-100">{showDiff ? 'Compare Changes' : 'Evolved Content'}</h2>
                    {translatedContent && !showDiff && (
                         <button onClick={() => setTranslatedContent(null)} className="text-xs text-teal-400 hover:text-teal-300 hover:underline">(Show Original)</button>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={() => setShowDiff(!showDiff)} className={`p-2 rounded-md transition-colors ${showDiff ? 'bg-teal-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`} title={showDiff ? "Show Evolved Text" : "View Changes"}>
                        <DiffIcon className="h-5 w-5" />
                    </button>
                    <button onClick={handleTranslate} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50" title="Translate to Brazilian Portuguese" disabled={isTranslating}>
                        {isTranslating ? <LoadingIcon className="h-5 w-5 animate-spin" /> : <TranslateIcon className="h-5 w-5" />}
                    </button>
                    <button onClick={handleCopyToClipboard} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Copy as Markdown">
                        {isCopied ? <CheckIcon className="h-5 w-5 text-green-400" /> : <CopyIcon className="h-top-5 w-5" />}
                    </button>
                    <button onClick={handleDownload} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Download as Markdown">
                        <DownloadIcon className="h-5 w-5" />
                    </button>
                    <button onClick={handleExport} className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="Export as JSON">
                        <ExportIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {translationError && <p className="text-red-400 text-sm">{translationError}</p>}
            
            {showDiff ? (
                <DiffView originalContent={originalContent} evolvedContent={suggestions} />
            ) : (
                <>
                    <div 
                        className="text-gray-300 select-text prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300"
                        onMouseUp={handleMouseUp}
                        dangerouslySetInnerHTML={renderMarkdown(displayedContent)} 
                    />

                    {keywords.length > 0 && !translatedContent && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-200 mb-3 pt-4 border-t border-gray-700">Analyzed Keywords</h3>
                            <div className="flex flex-wrap gap-2">
                                {keywords.map((keyword, index) => (
                                    <button 
                                        key={index} 
                                        onClick={() => onAddKeyword(keyword)}
                                        className="px-3 py-1 bg-teal-600/20 text-teal-300 text-sm rounded-full hover:bg-teal-600/40 transition-colors"
                                        title={`Add "${keyword}" to your intention`}
                                    >
                                        {keyword}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SuggestionDisplay;