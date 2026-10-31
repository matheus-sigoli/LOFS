-- Bucket PRIVADO para fotos de atletas (ADR 0004). Leitura só via URL assinada gerada
-- no servidor para atletas com consentimento ativo. Upload só por admin com 2FA.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'schema storage ausente (ambiente fora do Supabase) — pulando';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', false, 2097152, array['image/webp','image/jpeg','image/png'])
  on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp','image/jpeg','image/png'];

  execute $p$create policy "fotos: admin envia" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and (select private.is_admin_aal2()) and name ~ '^atletas/[0-9a-f-]{36}\.(webp|jpg|png)$')$p$;
  execute $p$create policy "fotos: admin substitui" on storage.objects for update to authenticated
    using (bucket_id = 'fotos' and (select private.is_admin_aal2()))$p$;
  execute $p$create policy "fotos: admin remove" on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and (select private.is_admin_aal2()))$p$;
end $$;
