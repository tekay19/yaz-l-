# Kurulum

Gereken: Ubuntu 24.04, 2 vCPU / 4 GB RAM / 40 GB disk, Docker + Compose eklentisi, alan adı (A kaydı sunucu IP'sine).

1. `git clone https://github.com/tekay19/yaz-l-.git /opt/sinavoku && cd /opt/sinavoku`
2. `cp .env.example .env` ve değerleri doldur (`openssl rand -base64 48` ile gizli anahtarlar).
3. `docker compose up -d --build`
4. Kontrol: `curl -fsS https://$DOMAIN/api/health` → `{"ok":true}`; `docker compose logs -f worker` → `[worker] started`.
5. Güvenlik duvarı: yalnız 22, 80, 443 açık (`ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable`). Postgres dışarıya açılmaz (compose'da port yayınlanmıyor).

Yedek: `chmod +x scripts/backup.sh` ve `crontab -e` → `30 3 * * * /opt/sinavoku/scripts/backup.sh`. Yedekler `backups/` altına yazılır (git'e ve Docker imajına girmez). Ayrıca sunucu dışına (ör. başka bir bölgede nesne deposu) kopyalanmalıdır; aksi halde disk arızasında yedek de gider.

Güncelleme: `git pull && docker compose up -d --build` (migrate servisi her seferinde çalışır, sonra app/worker yeniden başlar).
Geri alma: `git checkout <önceki commit> && docker compose up -d --build`. Migration'lar ileri yönlüdür; şema değiştiren sürümü geri almadan önce yedekten dönüş planlanır.
Yedekten dönüş: `docker compose exec -T db pg_restore -U sinavoku -d sinavoku --clean < backups/<dosya>.dump`
Yedek tatbikatı: ilk kurulumdan sonra bir kez, gerçek bir arıza beklemeden, son yedeği **ayrı bir veritabanına** geri yükleyip dene; asıl `sinavoku` veritabanına dokunulmaz: `docker compose exec -T db createdb -U sinavoku sinavoku_tatbikat`, sonra `docker compose exec -T db pg_restore -U sinavoku -d sinavoku_tatbikat < backups/<dosya>.dump`, sonra `docker compose exec -T db psql -U sinavoku -d sinavoku_tatbikat -c 'select count(*) from users'` (sayı canlıdakiyle tutmalı), en son `docker compose exec -T db dropdb -U sinavoku sinavoku_tatbikat`. Test edilmemiş bir yedek, yedek değildir.
