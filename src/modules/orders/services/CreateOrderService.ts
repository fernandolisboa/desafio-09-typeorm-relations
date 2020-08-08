import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IOrdersRepository from '../repositories/IOrdersRepository';

import Order from '../infra/typeorm/entities/Order';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productsIds = products.map(({ id }) => ({ id }));

    const baseProducts = await this.productsRepository.findAllById(productsIds);

    const orderData = products.map(({ id: product_id, quantity }) => {
      const baseProduct = baseProducts.find(({ id }) => id === product_id);

      if (!baseProduct) {
        throw new AppError(
          `You tried to create an order with an invalid product. [ID: ${product_id}]`,
        );
      }

      const remainingAmount = baseProduct.quantity - quantity;

      if (remainingAmount < 0) {
        throw new AppError(`The product with ID ${product_id} is sold out.`);
      }

      const orderProduct = {
        product_id,
        price: baseProduct.price,
        quantity,
      };

      const newProduct = {
        id: baseProduct.id,
        quantity: remainingAmount,
      };

      return {
        orderProduct,
        newProduct,
      };
    });

    const orderProducts = orderData.map(({ orderProduct }) => orderProduct);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const newProducts = orderData.map(({ newProduct }) => newProduct);

    await this.productsRepository.updateQuantity(newProducts);

    return order;
  }
}

export default CreateOrderService;
