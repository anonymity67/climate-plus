import ClientApplication from './client-application';

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { view, lang, workspace } = await searchParams;
  return (
    <ClientApplication
      view={typeof view === 'string' ? view : ''}
      bangla={lang === 'bn'}
      advanced={workspace === 'advanced'}
    />
  );
}
