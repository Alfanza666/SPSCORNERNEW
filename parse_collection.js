import fs from 'fs';

const collection = JSON.parse(fs.readFileSync('postman_collection.json', 'utf8'));

const targetIds = [
  '005ef6ea-96e4-47f7-9282-afd1ce5a2904',
  '3733b82a-e8c0-432a-9f48-26bdba298df4',
  '5f0710b1-1aaa-4ece-aab2-a8e04b3ec9c6',
  '473eae42-0c4c-49ea-af0f-3c8436fcacbd',
  '556cf73c-ee67-4222-beed-c6849b0f3284',
  '2c252bed-47c6-4b88-9c68-e9906c0d7e4d',
  '916bc291-6fe9-4ffc-a678-7703d6def9d7'
];

function findItems(items) {
  for (const item of items) {
    if (targetIds.includes(item.id)) {
      console.log('---');
      console.log('Name:', item.name);
      console.log('Body:', JSON.stringify(item.request?.body, null, 2));
    }
    if (item.item) {
      findItems(item.item);
    }
  }
}

findItems(collection.item);
