-- Gestão de papéis pelo e-mail (auth.users não é exposto à API).
create function public.usuarios_painel()
returns table (user_id uuid, email text, papeis public.papel_usuario[], criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, array_agg(p.papel order by p.papel), min(p.created_at)
    from public.papel p join auth.users u on u.id = p.user_id
    group by u.id, u.email
    order by u.email;
end $$;

create function public.conceder_papel(p_email text, p_papel public.papel_usuario)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    return false; -- a pessoa precisa entrar uma vez no site antes
  end if;
  insert into public.papel (user_id, papel) values (v_id, p_papel) on conflict do nothing;
  return true;
end $$;

-- Mesários disponíveis para atribuição em partidas
create function public.mesarios()
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query select u.id, u.email::text from public.papel p join auth.users u on u.id = p.user_id
    where p.papel = 'mesario' order by u.email;
end $$;

revoke execute on function public.usuarios_painel(), public.conceder_papel(text, public.papel_usuario), public.mesarios() from public, anon;
grant execute on function public.usuarios_painel(), public.conceder_papel(text, public.papel_usuario), public.mesarios() to authenticated;
