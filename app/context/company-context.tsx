"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../utils/supabase/client';

interface Company {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  instagram_url: string | null;
  logo_path: string | null;
  accent_emoji: string | null;
}

interface CompanyContextValue {
  company: Company | null;
  companyId: number | null;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  companyId: null,
  loading: true,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const slug = process.env.NEXT_PUBLIC_COMPANY_SLUG;
    if (!slug) {
      console.error('NEXT_PUBLIC_COMPANY_SLUG is not set');
      setLoading(false);
      return;
    }

    supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Error loading company:', error);
        setCompany(data ?? null);
        setLoading(false);
      });
  }, []);

  return (
    <CompanyContext.Provider value={{ company, companyId: company?.id ?? null, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
