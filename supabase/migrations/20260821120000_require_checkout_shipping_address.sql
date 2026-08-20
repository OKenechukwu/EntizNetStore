-- Patch the deployed checkout function to require an address whenever any
-- cart item requires shipping. Fresh databases already include this guard in
-- the canonical foundation migration.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_checkout_session';
  if position('Shipping address is required' in v_definition)=0 then
    v_definition:=replace(v_definition,
      '    if v_product.id is null then raise exception ''Product is unavailable'' using errcode=''22023''; end if;',
      '    if v_product.id is null then raise exception ''Product is unavailable'' using errcode=''22023''; end if;'||chr(10)||
      '    if v_product.requires_shipping and p_shipping_address is null then'||chr(10)||
      '      raise exception ''Shipping address is required'' using errcode=''22023'';'||chr(10)||
      '    end if;');
    execute v_definition;
  end if;
end;
$migration$;
