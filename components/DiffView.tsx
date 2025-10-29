import React from 'react';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';

interface DiffViewProps {
    originalContent: string;
    evolvedContent: string;
}

const DiffView: React.FC<DiffViewProps> = ({ originalContent, evolvedContent }) => {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(originalContent, evolvedContent);
    dmp.diff_cleanupSemantic(diffs);

    const originalPane = diffs.map(([op, text], index) => {
        if (op === DIFF_INSERT) return null;
        const style = op === DIFF_DELETE 
            ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', textDecoration: 'line-through' } 
            : {};
        return <span key={index} style={style}>{text}</span>;
    }).filter(Boolean);

    const evolvedPane = diffs.map(([op, text], index) => {
        if (op === DIFF_DELETE) return null;
        const style = op === DIFF_INSERT 
            ? { backgroundColor: 'rgba(34, 197, 94, 0.2)' } 
            : {};
        return <span key={index} style={style}>{text}</span>;
    }).filter(Boolean);

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-100">Content Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Content Pane */}
                <div>
                    <h4 className="text-lg font-medium text-gray-300 mb-2 pb-2 border-b border-gray-600">Original</h4>
                    <div className="p-4 bg-gray-900 rounded-md whitespace-pre-wrap text-gray-300 leading-relaxed">
                        {originalPane}
                    </div>
                </div>
                {/* Evolved Content Pane */}
                <div>
                    <h4 className="text-lg font-medium text-gray-300 mb-2 pb-2 border-b border-gray-600">Evolved</h4>
                    <div className="p-4 bg-gray-900 rounded-md whitespace-pre-wrap text-gray-200 leading-relaxed">
                        {evolvedPane}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiffView;
