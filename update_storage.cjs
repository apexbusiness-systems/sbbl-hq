const fs = require('fs');

let config = fs.readFileSync('supabase/config.toml', 'utf8');

if (!config.includes('[storage.buckets.media]')) {
  const insertIndex = config.indexOf('[storage.s3_protocol]');
  const newConfig = config.substring(0, insertIndex) + `
[storage.buckets.media]
public = true
file_size_limit = "50MiB"
allowed_mime_types = ["image/jpeg", "image/png", "image/webp", "video/mp4"]

` + config.substring(insertIndex);

  fs.writeFileSync('supabase/config.toml', newConfig);
  console.log("Updated config.toml");
} else {
  console.log("Already updated");
}
