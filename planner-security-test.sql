-- Integration test. All synthetic users and workspace data are rolled back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.partner',gen_random_uuid()::text,true),set_config('test.stranger',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.partner')::uuid),(current_setting('test.stranger')::uuid);
set local role authenticated;
do $$
declare wid uuid; code uuid; rev bigint; denied boolean;
begin
  perform set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
  wid:=public.create_wedding('{"version":2}'::jsonb);
  if not exists(select 1 from public.wedding_workspaces where id=wid) then raise exception 'Owner cannot read workspace'; end if;
  code:=public.invite_wedding_partner(wid);
  rev:=public.save_wedding(wid,1,'{"version":2,"test":"owner"}'::jsonb);
  if rev<>2 then raise exception 'Revision did not increment'; end if;
  denied:=false;
  begin perform public.save_wedding(wid,1,'{"version":2}'::jsonb); exception when others then if SQLERRM like 'CONFLICT:%' then denied:=true;else raise;end if;end;
  if not denied then raise exception 'Stale save was allowed'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.stranger'),true);
  if exists(select 1 from public.wedding_workspaces where id=wid) then raise exception 'Stranger can read private workspace'; end if;
  denied:=false;
  begin perform public.save_wedding(wid,2,'{"version":2}'::jsonb); exception when others then if SQLERRM='Access denied' then denied:=true;else raise;end if;end;
  if not denied then raise exception 'Stranger can write workspace'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.partner'),true);
  if public.join_wedding(code)<>wid then raise exception 'Partner joined wrong workspace'; end if;
  if not exists(select 1 from public.wedding_workspaces where id=wid) then raise exception 'Partner cannot read'; end if;
  rev:=public.save_wedding(wid,2,'{"version":2,"test":"partner"}'::jsonb);
  if rev<>3 then raise exception 'Partner cannot save'; end if;
  denied:=false;
  begin perform public.invite_wedding_partner(wid); exception when others then if SQLERRM='Both partner accounts are already connected' then denied:=true;else raise;end if;end;
  if not denied then raise exception 'Third-member invitation allowed'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.stranger'),true);
  denied:=false;
  begin perform public.join_wedding(code); exception when others then if SQLERRM='Invitation is invalid or expired' then denied:=true;else raise;end if;end;
  if not denied then raise exception 'Used invitation can be replayed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  if has_table_privilege(current_user,'public.wedding_workspaces','SELECT') then raise exception 'Anonymous table access allowed'; end if;
  if has_function_privilege(current_user,'public.create_wedding(jsonb)','EXECUTE') then raise exception 'Anonymous RPC allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: owner and partner access, outsider denial, stale-save conflict, two-member cap, invitation replay denial, anonymous restrictions. All test data rolled back.' as result;
