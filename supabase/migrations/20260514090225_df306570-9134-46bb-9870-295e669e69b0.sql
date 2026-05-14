insert into storage.buckets (id, name, public) values ('parcel-item-images', 'parcel-item-images', true) on conflict (id) do nothing;

create policy "parcel_item_images_public_read" on storage.objects for select using (bucket_id = 'parcel-item-images');
create policy "parcel_item_images_public_insert" on storage.objects for insert with check (bucket_id = 'parcel-item-images');
create policy "parcel_item_images_public_update" on storage.objects for update using (bucket_id = 'parcel-item-images');
create policy "parcel_item_images_public_delete" on storage.objects for delete using (bucket_id = 'parcel-item-images');