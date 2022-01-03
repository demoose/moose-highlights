module.exports = {
    collections: {
      books: {
        path: 'posts',
        output: false,
        _sort_key: 'date',
        _singular_name: 'Book',
        _singular_key: 'book',
        _disable_add: 'false',
        _add_options: [
          {
            name: 'Add A New Book',
            icon: 'person_add',
            href: 'cloudcannon::editor/:collections_dir/_staff/.:extension🆕'
          }
        ]
      }
    }
  };