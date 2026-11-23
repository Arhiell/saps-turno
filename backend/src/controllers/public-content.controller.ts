import type {
  RequestHandler,
} from 'express';

import * as service
  from '../services/public-news.service.js';

import {
  municipalNews,
} from '../services/municipal-news.service.js';

import {
  newsId,
  newsInput,
  newsQuery,
} from '../validators/public-news.validator.js';

// Obtiene el listado público de noticias.
export const list: RequestHandler =
  async (
    req,
    res,
    next
  ) => {
    try {
      const query =
        newsQuery.parse(
          req.query
        );

      const result =
        await service.publicNews(
          query
        );

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Obtiene el detalle público de una noticia.
export const detail: RequestHandler =
  async (
    req,
    res,
    next
  ) => {
    try {
      const id =
        newsId.parse(
          req.params.id
        );

      const result =
        await service.publicNewsDetail(
          id
        );

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Obtiene las noticias provenientes del servicio municipal.
export const municipal: RequestHandler =
  async (
    _req,
    res,
    next
  ) => {
    try {
      const result =
        await municipalNews();

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Obtiene las opciones disponibles para la gestión de noticias.
export const options: RequestHandler =
  async (
    _req,
    res,
    next
  ) => {
    try {
      const result =
        await service.newsOptions();

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Obtiene las noticias disponibles para administración.
export const adminList: RequestHandler =
  async (
    req,
    res,
    next
  ) => {
    try {
      const query =
        newsQuery.parse(
          req.query
        );

      const result =
        await service.adminNews(
          req.user!,
          query
        );

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Obtiene el detalle de una noticia desde la administración.
export const adminDetail: RequestHandler =
  async (
    req,
    res,
    next
  ) => {
    try {
      const id =
        newsId.parse(
          req.params.id
        );

      const result =
        await service.adminNewsDetail(
          req.user!,
          id
        );

      res.json(
        result
      );
    } catch (error) {
      next(error);
    }
  };

// Crea una noticia nueva o actualiza una existente.
export const save: RequestHandler =
  async (
    req,
    res,
    next
  ) => {
    try {
      const id =
        req.params.id
          ? newsId.parse(
              req.params.id
            )
          : null;

      const input =
        newsInput.parse(
          req.body
        );

      const id_noticia =
        await service.saveNews(
          req.user!,
          id,
          input
        );

      res
        .status(
          id
            ? 200
            : 201
        )
        .json({
          id_noticia,
        });
    } catch (error) {
      next(error);
    }
  };