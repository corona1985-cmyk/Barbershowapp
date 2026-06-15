export type LegalDocumentType = 'terminos' | 'privacidad';

export function getLegalDocumentFromUrl(): LegalDocumentType | null {
    if (typeof window === 'undefined') return null;
    const param = new URLSearchParams(window.location.search).get('legal');
    if (param === 'terminos' || param === 'privacidad') return param;
    return null;
}

export function navigateToLegal(type: LegalDocumentType): void {
    const url = new URL(window.location.href);
    url.searchParams.set('legal', type);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
}

export function closeLegalDocument(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('legal');
    const next = url.search ? `${url.pathname}${url.search}` : url.pathname;
    window.history.replaceState({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
}

export const LEGAL_TITLES: Record<LegalDocumentType, string> = {
    terminos: 'Términos y condiciones',
    privacidad: 'Política de privacidad',
};
