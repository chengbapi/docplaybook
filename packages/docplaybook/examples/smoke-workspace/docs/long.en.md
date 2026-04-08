# Long Document Batch Translation Test

## Overview

This page is used to observe the behavior of batch translation.

It should trigger multi-paragraph translation rather than a single-block call.

## Background

The documentation team wants to reduce duplicate translations and reuse confirmed terminology.

If an article is long, the system should process it in batches while still preserving article-level writeback.

## Terminology

The Wiki is used to capture rules.

Spaces are used to organize content.

Tenants are used to isolate data.

## Links

For more information, see [Configuration instructions](./format-heavy.md).

## Commands

Running `docplaybook translate . --force` forces retranslation.

## Conclusion

The focus of this page is not the content itself but reliably producing multiple translatable blocks.
