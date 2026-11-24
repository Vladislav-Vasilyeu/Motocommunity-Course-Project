-- Repair only exact corrupted values written by earlier seed versions.
UPDATE "Community"
SET "city" = 'Беларусь'
WHERE "id" = 'community-touring' AND "city" = 'Р‘РµР»Р°СЂСѓСЃСЊ';

UPDATE "User"
SET "displayName" = 'Илья Романов'
WHERE "email" = 'ilya@motoclub.local' AND "displayName" = 'РР»СЊСЏ Р РѕРјР°РЅРѕРІ';
