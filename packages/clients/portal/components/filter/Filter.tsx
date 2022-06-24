import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';

import { Icon } from '../icons/Icon';
import { Button } from '../buttons/Button';
import { Dropdown } from '../dropdown/Dropdown';
import { Title } from '../title/Title';
import { Checkbox } from '../checkbox/Checkbox';

export const Filter = ({ isMobile, uniqueDomainOption, uniqueProductOption }) => {
  const optionList = {
    product: [...uniqueProductOption],
    domain: [...uniqueDomainOption],
  };
  const [isOpenFilters, setIsOpenFilters] = useState(false);
  const [isOpenOptions, setIsOpenOptions] = useState(false);
  const [activeOptions, setActiveOptions] = useState('');
  const [checkedOptionListDomain, setCheckedOptionListDomain] = useState([]);
  const [checkedOptionListProduct, setCheckedOptionListProduct] = useState([]);

  useEffect(() => {
    if (!window.localStorage.getItem('filteredBy')) return;
    const { domain, product } = JSON.parse(
      window.localStorage.getItem('filteredBy'),
    );
    setCheckedOptionListDomain(domain);
    setCheckedOptionListProduct(product);
  }, []);

  const handelCheckbox = (e) => {
    const { id, checked } = e.target;
    if (activeOptions === 'product') {
      setCheckedOptionListProduct([...checkedOptionListProduct, id]);
      if (!checked) {
        setCheckedOptionListProduct(
          checkedOptionListProduct.filter((item) => item !== id),
        );
      }
    }
    if (activeOptions === 'domain') {
      setCheckedOptionListDomain([...checkedOptionListDomain, id]);
      if (!checked) {
        setCheckedOptionListDomain(
          checkedOptionListDomain.filter((item) => item !== id),
        );
      }
    }
  };

  const applyFilterOptions = (e) => {
    window.localStorage.setItem(
      'filteredBy',
      JSON.stringify({
        domain: checkedOptionListDomain,
        product: checkedOptionListProduct,
      }),
    );
    setIsOpenOptions(false);
    setIsOpenFilters(false);
    setActiveOptions('');
  };

  const resetAllOptions = (e) => {
    window.localStorage.removeItem('filteredBy');
    setCheckedOptionListProduct([]);
    setCheckedOptionListDomain([]);
  };

  const listOption = (items) =>
    items.map((item, idx) => {
      const isChecked =
        activeOptions === 'product'
          ? checkedOptionListProduct.includes(item)
          : checkedOptionListDomain.includes(item);
      return (
        <div
          className={`flex items-center gap-3 w-full cursor-pointer p-2.5 ${
            isChecked && 'bg-indigo-50'
          }`}
          key={idx}
        >
          <Checkbox checked={isChecked} handelCheckbox={handelCheckbox} id={item} />
          <button type="button">
            <p className="text-indigo-500 text-normal">{item}</p>
          </button>
        </div>
      );
    });

  return (
    <div>
      <Button
        as="button"
        label={`${isMobile ? '' : 'Filter'}`}
        size="md"
        plain
        icon="FilterIcon"
        iconPosition="before"
        theme="indigo"
        onClick={(e) => {
          setIsOpenFilters(!isOpenFilters);
          setIsOpenOptions(false);
        }}
      />
      {isOpenFilters && (
        <Dropdown position={isMobile ? 'right-0' : 'right-0'}>
          {!isOpenOptions && (
            <div className="flex flex-col items-start px-3 py-5 w-full">
              <div className="flex justify-between items-center gap-2 w-full mb-2.5 pr-2.5">
                <Title size="xxs">Select Filter:</Title>
                <button type="button" className="" onClick={resetAllOptions}>
                  <Icon name="X" className="w-6 h-6" />
                </button>
              </div>
              {Object.keys(optionList).map((filterName, idx) => (
                <div
                  className="flex items-center justify-between w-full cursor-pointer p-2.5"
                  key={idx}
                  onClick={(e) => {
                    setIsOpenOptions(!isOpenOptions);
                    setActiveOptions(filterName);
                  }}
                >
                  <div className="flex gap-2 items-center">
                    <button
                      key={idx}
                      type="button"
                      id={filterName}
                      className="py-2.5 capitalize text-base"
                    >
                      {filterName}
                    </button>
                    {Boolean(checkedOptionListDomain.length) &&
                      filterName === 'domain' && (
                        <div className="bg-indigo-50 text-indigo-500 px-1.5 py-px rounded">
                          {checkedOptionListDomain.length}
                        </div>
                      )}
                    {Boolean(checkedOptionListProduct.length) &&
                      filterName === 'product' && (
                        <div className="bg-indigo-50 text-indigo-500 px-1.5 py-px rounded">
                          {checkedOptionListProduct.length}
                        </div>
                      )}
                  </div>
                  <Icon
                    name="ChevronRightIcon"
                    className="w-4 h-4 text-indigo-100"
                  />
                </div>
              ))}
            </div>
          )}
          {isOpenOptions && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-start px-3 py-5 w-full bg-white"
            >
              <div className="flex gap-2 items-center justify-center mb-2.5">
                <div
                  className="cursor-pointer"
                  onClick={(e) => setIsOpenOptions(false)}
                >
                  <Icon name="ChevronLeftIcon" className="w-6 h-6" />
                </div>
                <div>
                  <Title size="xxs">Filter by {activeOptions}</Title>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {listOption(optionList[activeOptions])}
              </div>
              <div className="flex w-full  justify-end pt-2.5">
                <Button label="Apply" onClick={applyFilterOptions} />
              </div>
            </motion.div>
          )}
        </Dropdown>
      )}
    </div>
  );
};
