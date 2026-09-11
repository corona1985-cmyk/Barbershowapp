import React from 'react';
import LanguageSwitcher from '../LanguageSwitcher';

export const guestShell = (content: React.ReactNode) => (
    <>
        <LanguageSwitcher floating />
        {content}
    </>
);

export const ViewFallback = () => (
    <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-12 h-12 border-4 border-[#ffd427] border-t-transparent rounded-full animate-spin" />
    </div>
);
